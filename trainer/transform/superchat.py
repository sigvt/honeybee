# To add a new cell, type '# %%'
# To add a new markdown cell, type '# %% [markdown]'
# %%
import pandas as pd
import numpy as np


def collect_superchat(df: pd.DataFrame):
    symMap = {
        '¥': "USD",
        'PHP': "PHP",
        'PEN': "USD",
        'HK$': "HKD",
        'NOK': "NOK",
        'NT$': "TWD",
        '£': "GBP",
        '$': "USD",
        'CA$': "CAD",
        '€': "USD",
        'R$': "BRL",
        'ARS': "ARS",
        'MX$': "MXN",
        'HUF': "HUF",
        'A$': "AUD",
        'SGD': "SGD",
        'PLN': "PLN",
        '₩': "KRW",
        'NZ$': "NZD",
        "RUB": "RUB",
        "₹": "INY",
        "CHF": "CHF",
        "SEK": "SEK",
        "CZK": "CZK"
    }

    approxRates = {
        "AUD": 0.0127098151,
        "BRL": 0.0501367157,
        "CAD": 0.0123889679,
        "GBP": 0.0071446183,
        "HKD": 0.0748624941,
        "HUF": 2.872293346,
        "KRW": 10.5964122017,
        "MXN": 0.1921416153,
        "NOK": 0.0835411728,
        "PHP": 0.4638849376,
        "SGD": 0.0128315157,
        "USD": 0.0096562352,
        "TWD": 3.68028,
        "ARS": 1.26136,
        "PLN": 0.03559,
        "NZD": 0.03559,
        "RUB": 0.706,
        "INY": 0.703,
        "CHF": 0.009,
        "SEK": 0.08,
        "CZK": 0.208
    }
    superchat = pd.unique(df[df['purchase'].notnull()]['purchase'].apply(
        lambda x: x['amount'] / approxRates[symMap[x['currency']]])).sum()

    return superchat