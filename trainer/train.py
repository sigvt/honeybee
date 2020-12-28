#%%
import lightgbm as lgb
import numpy as np
from os.path import join, abspath, dirname
import pandas as pd
# from sklearn.model_selection import train_test_split
import optuna.integration.lightgbm as optuna_lgb
import math
from operator import itemgetter
import itertools
from sklearn.model_selection import KFold


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
    return math.exp(len(text) / rl_len)


data_dir = abspath(join(dirname(__file__), '../data'))
print('data_dir:', data_dir)
train_data_path = join(data_dir, 'train.parquet')


def loadData():
    df = pd.read_parquet(train_data_path)
    df.drop(columns=[
        'id', 'authorName', 'authorPhoto', 'authorChannelId', 'timestampUsec',
        'originChannelId', 'originVideoId', 'membership', 'purchase',
        'rawMessage', 'message'
    ],
            inplace=True)
    return df


# %%

data = loadData()

grp = data.groupby('spam')
grp = grp.apply(lambda x: x.sample(grp.size().min()))
data = pd.DataFrame(grp).reset_index(drop=True)
print(len(data))

x = data.drop(columns='spam')
y = data['spam']
# x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.33)
# print(x_train.head())
# print(y_train.head())
# validation_data = lgb.Dataset(x_test, label=y_test)

# %%

train_data = lgb.Dataset(x, label=y)

param = {
    'device_type': 'gpu',
    'objective': 'binary',
    'boosting': 'gbdt',
    "verbosity": -1,
    # 'metric': 'kullback_leibler',
    'metric': 'auc',
    # 'is_unbalance': True,
}
tuner = optuna_lgb.LightGBMTunerCV(param,
                                   train_data,
                                   stratified=False,
                                   verbose_eval=100,
                                   early_stopping_rounds=100,
                                   return_cvbooster=True,
                                   folds=KFold(n_splits=3, shuffle=True))
tuner.run()
bst = tuner.get_best_booster()
bst.save_model('model.txt')

#%%

from sentence_transformers import SentenceTransformer
model = SentenceTransformer('paraphrase-xlm-r-multilingual-v1')

#%%
msg = [
    'HEEERRREESSS SUISEI~~~', 'wwwww', 'なにそれ', 'YABE', 'やばい', '草', 'lol why',
    'クソクソクソ', '死ね死ね死ね死ね死ね死ね死ね死ね死ね死ね死ね死ね',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'きもきもきも',
    'パピオン加藤最強!!パピオン加藤最強!!!パピオン加藤最強!!パピオン加藤最強!!!'
]
bwt = np.nan
test_data = [[
    0.0, 0.0, 0.0, 0.0, 0.0, 6,
    len(x),
    len(set(x)),
    balanced_bwt_rl_entropy([x])
] for x in msg]
print(test_data)
test_df = pd.DataFrame(test_data,
                       columns=[
                           'isVerified', 'isOwner', 'isModerator', 'isMember',
                           'isSuperchat', 'authorLength', 'messageLength',
                           'messageUniqueness', 'bwtrl'
                       ])
embeds = model.encode(msg)
emb_columns = ['emb_' + str(i) for i in range(embeds.shape[1])]
test_df[emb_columns] = embeds
test_df['isMember'] = test_df['isMember']
test_df['isSuperchat'] = test_df['isSuperchat']
sam = data[data['spam'] == 1.0].sample(10)
val_pred = bst.predict(test_df)
print(val_pred)
print((val_pred > 0.65).astype(int))
# %%

# lgb.plot_importance(bst)

#%%
bst.params