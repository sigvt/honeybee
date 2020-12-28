import lightgbm as lgb
import numpy as np

if __name__ == '__main__':
    bst = lgb.Booster(model_file='model.txt')  # init model

    data = np.random.rand(7, 10)
    ypred = bst.predict(data)
    print(ypred)