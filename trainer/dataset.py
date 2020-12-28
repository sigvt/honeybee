#%%
import glob
import itertools
import math
from operator import itemgetter
from os.path import join

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pandarallel import pandarallel
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

data_dir = '../data/'
raw_data_dir = join(data_dir, 'raw')


# https://gist.github.com/vbkaisetsu/d7c08e9c5aabe13686dd554ddfadf076
def suffix_array(arr):
    arr_size = len(arr)
    arr_int = {v: k for k, v in enumerate(sorted(set(arr)))}
    arr = [arr_int[x] for x in arr]
    arr.append(-1)
    suf = [[i, arr[i], arr[i + 1]] for i in range(arr_size)]
    suf.sort(key=itemgetter(1, 2))
    idx = [0] * arr_size
    k = 2
    while k < arr_size:
        r = 0
        prev_r = suf[0][1]
        for i in range(arr_size):
            if suf[i][1] != prev_r or suf[i - 1][2] != suf[i][2]:
                r += 1
            prev_r = suf[i][1]
            suf[i][1] = r
            idx[suf[i][0]] = i
        for i in range(arr_size):
            next_idx = suf[i][0] + k
            suf[i][2] = suf[idx[next_idx]][1] if next_idx < arr_size else -1
        suf.sort(key=itemgetter(1, 2))
        k <<= 1
    return [x[0] for x in suf]


# https://gist.github.com/vbkaisetsu/d7c08e9c5aabe13686dd554ddfadf076
def bwt_encode(data):
    data_ref = suffix_array(data)
    bwt_ref = (x - 1 for x in data_ref)
    return ''.join([data[x] for x in bwt_ref])


def balanced_bwt_rl_entropy(text):
    rl_len = len([ch for ch, _ in itertools.groupby(bwt_encode(text))])
    return len(text) / rl_len


#%%
tqdm.pandas()
pandarallel.initialize(nb_workers=6, progress_bar=True)

files = glob.glob(join(raw_data_dir, "*.jsonl"))
print(f'# of files: {str(len(files))}')
files = [pd.read_json(open(f), lines=True) for f in files]

# concat df
df = pd.concat(files, axis=0)
df.info()

#%%
# transform
chat_df = df[df["type"] == "addChatItemAction"].copy()
chat_df.drop(columns=[
    'type',
    'channelId',
    'targetId',
], inplace=True)
chat_df.drop_duplicates('id', inplace=True)

ban_df = df[df["type"] == "markChatItemsByAuthorAsDeletedAction"].copy()
ban_df = ban_df[['channelId', 'originVideoId', 'originChannelId']]

delete_actions_df = df[df["type"] == "markChatItemAsDeletedAction"].copy()
delete_actions_df = delete_actions_df[[
    'targetId', 'originVideoId', 'originChannelId'
]]

#%%
# preprocessing

# cleanup duplicated chat
deletedChatIds = delete_actions_df['targetId']
chat_df.drop(chat_df[chat_df['id'].isin(deletedChatIds)].index, inplace=True)

# cleanup custom emojis
chat_df['message'] = chat_df['message'].replace(to_replace='<.+?>',
                                                value='',
                                                regex=True)

# remove chat with empty message (superchat and messages only contain custom emojis)
chat_df = chat_df[chat_df['message'].notnull()]

# # convert datetime
chat_df['timestampUsec'] = pd.to_datetime(chat_df['timestampUsec'], unit='us')

# boolean features
chat_df['isMember'] = chat_df['membership'].notna()
chat_df['isSuperchat'] = chat_df['purchase'].notna()
chat_df['isOwner'].fillna(False, inplace=True)
chat_df['isVerified'].fillna(False, inplace=True)
chat_df['isModerator'].fillna(False, inplace=True)

#%%
# count features
chat_df['authorLength'] = chat_df['authorName'].apply(lambda x: len(str(x)))
chat_df['messageLength'] = chat_df['message'].apply(lambda x: len(str(x)))
chat_df['messageUniqueness'] = chat_df['message'].apply(
    lambda x: len(set(str(x))))

# manually exclude wrongly flagged users
spam_ids = ban_df["channelId"]
spam_excludes = pd.read_csv(join(data_dir, 'spam_exclusion.txt'),
                            header=None,
                            squeeze=True)
spam_ids = spam_ids[~spam_ids.isin(spam_excludes)]

# assume chat with flagged as deletion as suspicious chat
spam_rows = chat_df['authorChannelId'].isin(spam_ids)
chat_df['spam'] = 0.0
chat_df.loc[spam_rows, 'spam'] = 0.5

#%%
print('calculating bwtrl')


# calculate bwtrl
def calc_bwtrl(df):
    hist = chat_df[(chat_df['authorChannelId'] == df['authorChannelId']) &
                   (chat_df['timestampUsec'] <= df['timestampUsec'])][:20]

    full = ''.join(hist['message'].to_list())
    if len(full) == 0:
        return 0
    bwtrl = balanced_bwt_rl_entropy(full)
    return bwtrl


chat_df['bwtrl'] = 3.0 + np.random.randn() * 1.0

# narrow down the scope to banned chat for performance reasons
chat_df.loc[spam_rows, 'bwtrl'] = chat_df[spam_rows].parallel_apply(calc_bwtrl,
                                                                    axis=1)
# chat_df['bwtrl'] = chat_df.progress_apply(calc_bwtrl, axis=1)

#%%
print(chat_df.loc[spam_rows, 'bwtrl'].describe())

# assume chat with bwtrl > 50 as total spam
chat_df.loc[(chat_df['bwtrl'] > 10) &
            (~chat_df['authorChannelId'].isin(spam_excludes)), 'spam'] = 1.0

#%%
# message embedding
model = SentenceTransformer('paraphrase-xlm-r-multilingual-v1')
message_array = chat_df['message'].to_list()
embeds = model.encode(message_array, show_progress_bar=True)
emb_columns = ['emb_' + str(i) for i in range(embeds.shape[1])]
edf = pd.DataFrame(embeds, columns=emb_columns)
chat_df[emb_columns] = edf

#%%
# dtype conversion
chat_df['isMember'] = chat_df['isMember'].astype('float64')
chat_df['isSuperchat'] = chat_df['isSuperchat'].astype('float64')
chat_df['isOwner'] = chat_df['isOwner'].astype('float64')
chat_df['isVerified'] = chat_df['isVerified'].astype('float64')
chat_df['isModerator'] = chat_df['isModerator'].astype('float64')

#%%
# review
chat_df.info()
chat_df['spam'].describe()

print(f"# of chat: {str(len(chat_df))}")
print(f"# of banActions: {str(len(ban_df))}")
print(f"# of deleteActions: {str(len(delete_actions_df))}")

markedAsSpam = chat_df[chat_df["spam"] == 1.0]
harmless = chat_df[chat_df["spam"] == 0.0]
print(f'# of spam: {str(len(markedAsSpam))}')
print(markedAsSpam.describe())
print(f'# of not spam: {str(len(harmless))}')
print(harmless.describe())
print("spam ratio: ", len(markedAsSpam) / len(harmless))

# split data frame
markedAsSpam = markedAsSpam.sort_values('authorName')
target_col = ["authorName", "authorChannelId", "message", 'bwtrl', 'spam']
markedAsSpam[target_col].to_csv(join(data_dir, 'spam.csv'))

#%%
# create dataset
# chat_df.drop(columns=[
#     'authorName',
# ], inplace=True)
# chat_df.drop(columns=['rawMessage', 'message'], inplace=True)
# chat_df.drop(columns=[
#     'id',
#     'authorPhoto',
#     'authorChannelId',
#     'timestampUsec',
#     'originChannelId',
#     'originVideoId',
# ],
#  inplace=True)
chat_df.to_parquet(join(data_dir, 'train.parquet'))

# %%
