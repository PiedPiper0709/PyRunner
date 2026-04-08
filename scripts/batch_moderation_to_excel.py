#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量请求 360 Moderation 文本检测接口（/v2/moderations/text），将每行请求的检测结果写回到新的 Excel：
- 读取输入 Excel（所有 sheet），每一行作为一次请求；
- 文本 content、app、location、model（映射到请求头 Ref-Prom）来自不同列；
- 返回 result.suggest / result.labels / result.hit_words / request_id 分别写入四列；
- 保留原始列不变，并在表尾追加结果列；
- 每个 sheet 显示 tqdm 进度条；
- 默认并发 20 线程，复用 HTTP 连接池。

用法：
    python batch_moderation_to_excel.py 输入.xlsx 输出.xlsx

依赖：pandas openpyxl requests
可选：tqdm（未安装也能跑，只是不显示真实进度条）
    pip install pandas openpyxl requests tqdm
"""

import time
import json
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
from requests.adapters import HTTPAdapter

# ============== 配置区（从环境变量或命令行参数读取） ==============
import os
import argparse

_ENV_URLS = {
    "prod":    "https://api.360.cn/v2/moderations/text",
    "staging": "http://riskshield.so.qihoo.net/risk_shield/v1/verify/text",
    "test":    "http://10.176.196.72/risk_shield/v1/verify/text",
}

# 这两个变量在 main() 里赋值，其他函数直接用
API_URL = ""
AUTH_TOKEN = ""

# Excel 列名配置（不区分大小写匹配，但以首个匹配为准）
CONTENT_COL_CANDIDATES = ["query", "input", "prompt", "content"]
APP_COL_CANDIDATES = ["app", "应用"]
LOCATION_COL_CANDIDATES = ["location", "地区", "位置"]
MODEL_COL_CANDIDATES = ["model", "模型", "Ref-Prom"]

# 若缺少列时使用的默认值
DEFAULT_APP = "test"
DEFAULT_LOCATION = "test"
DEFAULT_MODEL = "360moderation-text-s13"

# 并发与稳健性
WORKERS = 20
TIMEOUT = 30
MAX_RETRIES = 2
BACKOFF = 1.5
# ===============================================


# tqdm 进度条（未安装则优雅降级）
try:
    from tqdm import tqdm
except Exception:
    class _DummyTqdm:
        def __init__(self, iterable=None, total=None, desc=None, unit=None):
            self.iterable = iterable
            self.total = total
            self.desc = desc
            self.unit = unit
            self.n = 0

        def update(self, n=1):
            self.n += n

        def close(self):
            pass

        def __iter__(self):
            if self.iterable is None:
                return iter(range(self.total or 0))
            return iter(self.iterable)

    def tqdm(iterable=None, total=None, desc=None, unit=None):
        return _DummyTqdm(iterable=iterable, total=total, desc=desc, unit=unit)


# 全局 Session，占位
_SESSION: Optional[requests.Session] = None


def _lc_index(cols: List[str]) -> Dict[str, int]:
    """将列名转为 小写列名 -> 原索引 的映射。"""
    return {str(c).strip().lower(): i for i, c in enumerate(cols)}


def _find_col(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    """在 df 中按候选列名（不区分大小写）找到第一命中列名；未命中返回 None。"""
    if not candidates:
        return None

    lc_map = _lc_index(list(df.columns))
    for name in candidates:
        key = str(name).strip().lower()
        if key in lc_map:
            return df.columns[lc_map[key]]
    return None


def ensure_result_columns(df: pd.DataFrame) -> pd.DataFrame:
    """确保结果列存在且为 object 类型，并放在表尾。"""
    cols_add = [
        "检测结果_suggest",
        "检测结果_labels",
        "检测结果_hit_words",
        "检测结果_request_id",
    ]
    for col in cols_add:
        if col not in df.columns:
            df[col] = pd.Series([None] * len(df), dtype="object")
        elif df[col].dtype != "object":
            df[col] = df[col].astype("object")

    base_cols = [c for c in df.columns if c not in cols_add]
    return df[base_cols + cols_add]


def parse_response(data: Dict[str, Any]) -> Dict[str, str]:
    """解析返回 JSON，提取 suggest / labels / hit_words / request_id。"""
    result = data.get("result") or {}
    suggest = ""
    labels_joined = ""
    hit_joined = ""

    if isinstance(result, dict):
        sv = result.get("suggest")
        if isinstance(sv, str):
            suggest = sv

        labels = result.get("labels")
        if isinstance(labels, list):
            labels_joined = " | ".join([str(x) for x in labels])

        hit_words = result.get("hit_words")
        if isinstance(hit_words, list):
            hit_joined = " | ".join([str(x) for x in hit_words])

    request_id = ""
    rid = data.get("request_id")
    if isinstance(rid, str):
        request_id = rid

    return {
        "suggest": suggest,
        "labels": labels_joined,
        "hit_words": hit_joined,
        "request_id": request_id,
    }


def call_api(session: requests.Session, content: str, app: str, location: str, model: str) -> Dict[str, str]:
    """调用 moderation 接口，返回解析后的字段。"""
    headers = {
        "Authorization": AUTH_TOKEN,
        "Ref-Prom": model,
    }

    # multipart/form-data，用 files 传 (None, value) 生成文本字段
    files = {
        "content": (None, content),
        "app": (None, app),
        "location": (None, location),
        "hit_words": (None, "true"),
        "l3_labels": (None, "true"),
        "trace_id":(None,"guanmingtest"),
        "pre_proc_switch": (None, json.dumps({"rag": "on"}, ensure_ascii=False)),
    }

    last_err: Optional[Exception] = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.post(API_URL, headers=headers, files=files, timeout=TIMEOUT)

            if resp.status_code != 200:
                raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")

            data = resp.json()

            if isinstance(data, dict) and isinstance(data.get("errno"), int) and data.get("errno") != 0:
                raise RuntimeError(f"errno={data.get('errno')} errmsg={data.get('errmsg')}")

            return parse_response(data)

        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES:
                sleep_s = BACKOFF ** (attempt - 1)
                time.sleep(sleep_s)
            else:
                break

    assert last_err is not None
    raise last_err


def get_content_series(df: pd.DataFrame) -> pd.Series:
    """找到文本内容列：优先 CONTENT_COL_CANDIDATES；否则尝试'题干'；最后第六列。"""
    col = _find_col(df, CONTENT_COL_CANDIDATES) or ("题干" if "题干" in df.columns else None)

    if col is None and df.shape[1] >= 6:
        return df.iloc[:, 5]

    if col is None:
        raise ValueError(f"找不到文本内容列（候选：{CONTENT_COL_CANDIDATES}），且列数不足6列")

    return df[col]


def get_param_value(
    df: pd.DataFrame,
    row_idx: int,
    candidates: List[str],
    default_value: Optional[str],
    name: str,
) -> str:
    """按候选列名获取参数值；若缺列使用默认；默认也为空则报错。"""
    col = _find_col(df, candidates)
    if col is not None:
        val = df.at[row_idx, col]
        if pd.notna(val) and str(val).strip() != "":
            return str(val)

    if default_value is not None:
        return str(default_value)

    raise ValueError(f"找不到列 {name}（候选={candidates}），且未配置默认值。")


def _build_session(pool_size: int) -> requests.Session:
    """构造带连接池的 Session，提升并发吞吐。"""
    session = requests.Session()
    adapter = HTTPAdapter(pool_connections=pool_size, pool_maxsize=pool_size)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def _worker_task(args: Tuple[int, str, str, str, str]) -> Tuple[int, Dict[str, str]]:
    """线程任务：输入 (idx, content, app, location, model)，返回 (idx, fields 或 ERROR)。"""
    idx, content, app, location, model = args

    try:
        if _SESSION is None:
            raise RuntimeError("_SESSION 未初始化")
        fields = call_api(_SESSION, content, app, location, model)
        return idx, fields
    except Exception as e:
        err = f"[ERROR] {e}"
        return idx, {
            "suggest": err,
            "labels": err,
            "hit_words": err,
            "request_id": "",
        }


def process_sheet(df: pd.DataFrame, sheet_name: str) -> pd.DataFrame:
    from concurrent.futures import ThreadPoolExecutor, as_completed

    df = ensure_result_columns(df)
    content_series = get_content_series(df)

    tasks: List[Tuple[int, str, str, str, str]] = []
    total = len(df)

    for i in range(total):
        content = content_series.iloc[i]

        if pd.isna(content) or str(content).strip() == "":
            df.at[i, "检测结果_suggest"] = None
            df.at[i, "检测结果_labels"] = None
            df.at[i, "检测结果_hit_words"] = None
            df.at[i, "检测结果_request_id"] = None
            continue

        try:
            app = get_param_value(df, i, APP_COL_CANDIDATES, DEFAULT_APP, "app")
            location = get_param_value(df, i, LOCATION_COL_CANDIDATES, DEFAULT_LOCATION, "location")
            model = get_param_value(df, i, MODEL_COL_CANDIDATES, DEFAULT_MODEL, "model/Ref-Prom")
        except Exception as e:
            err = f"[ERROR] {e}"
            df.at[i, "检测结果_suggest"] = err
            df.at[i, "检测结果_labels"] = err
            df.at[i, "检测结果_hit_words"] = err
            df.at[i, "检测结果_request_id"] = ""
            continue

        tasks.append((i, str(content), app, location, model))

    processed_init = total - len(tasks)
    pbar = tqdm(total=total, desc=f"处理 {sheet_name}", unit="行")

    try:
        if processed_init > 0:
            pbar.update(processed_init)

        if tasks:
            with ThreadPoolExecutor(max_workers=WORKERS) as ex:
                futures = [ex.submit(_worker_task, t) for t in tasks]

                for fut in as_completed(futures):
                    idx, fields = fut.result()
                    df.at[idx, "检测结果_suggest"] = fields.get("suggest", "")
                    df.at[idx, "检测结果_labels"] = fields.get("labels", "")
                    df.at[idx, "检测结果_hit_words"] = fields.get("hit_words", "")
                    df.at[idx, "检测结果_request_id"] = fields.get("request_id", "")
                    pbar.update(1)
    finally:
        pbar.close()

    return df


def main():
    global API_URL, AUTH_TOKEN, WORKERS, _SESSION

    parser = argparse.ArgumentParser(description="批量请求 360 Moderation 接口并写出 Excel")
    parser.add_argument("--input",   required=True,  help="输入 Excel 文件路径")
    parser.add_argument("--output",  default="output.xlsx", help="输出 Excel 文件路径")
    parser.add_argument("--env",     default="prod",
                        choices=list(_ENV_URLS.keys()),
                        help="目标环境：prod / staging / test（默认 prod）")
    parser.add_argument("--api_url", default=None,   help="直接指定 API URL（优先级高于 --env）")
    parser.add_argument("--workers", type=int, default=WORKERS, help=f"并发线程数（默认 {WORKERS}）")
    args = parser.parse_args()

    input_file  = args.input
    output_file = args.output

    # 设置全局变量
    API_URL    = args.api_url or os.getenv("MODERATION_API_URL") or _ENV_URLS[args.env]
    AUTH_TOKEN = "Bearer " + (os.getenv("MODERATION_TOKEN") or "fk3445945783.lpT4OgiCZDaP5z6el3PR3YVMYF3avzJIcac5da44")
    WORKERS    = args.workers
    _SESSION   = _build_session(pool_size=max(WORKERS * 2, 8))

    xls = pd.ExcelFile(input_file, engine="openpyxl")
    out_sheets: Dict[str, pd.DataFrame] = {}

    print(f"开始处理：{input_file}，共 {len(xls.sheet_names)} 个 sheet；并发={WORKERS}")

    for sheet in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet, engine="openpyxl")
        df_processed = process_sheet(df, sheet_name=sheet)
        out_sheets[sheet] = df_processed
        print(f"[OK] 处理完成：{sheet}（{len(df_processed)} 行）")

    with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
        for sn, df in out_sheets.items():
            df.to_excel(writer, sheet_name=sn, index=False)

    print(f"已写出到：{output_file}")


if __name__ == "__main__":
    main()