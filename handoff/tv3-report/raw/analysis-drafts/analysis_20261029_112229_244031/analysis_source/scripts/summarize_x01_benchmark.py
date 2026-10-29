"""X01.6: reproducible offline tables, PNG/SVG figures and Vietnamese discussion.

Reads original matrix evidence without overwriting it. No backend, benchmark,
database mutation, network request, Git commit or push is performed by this file.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from datetime import datetime
import csv
import json
import math
from pathlib import Path
import shutil
import statistics
import sys
import textwrap

from audit_x01_matrix import audit as matrix_audit, csv_rows, select_cohort, equal_number, require
from audit_x01_reliability import audit as reliability_audit
from run_x01_benchmark import ROOT, GENERATED, VIETNAM, generated_path, load_json, file_digest, write_new_json

MODES = ("direct", "bounded")
CLIENTS = (2, 5, 20)
MIB = 1024 ** 2
COLORS = {"direct": "#186A9A", "bounded": "#B75A20"}
METRICS = ("medianMs", "p95Ms", "p99Ms", "meanMs", "maxMs", "throughputPerSecond", "sentRatePerSecond",
           "nodeCpuMeanPercentOneCore", "nodeCpuPeakIntervalPercentOneCore", "nodePeakRssMiB", "nodeSampleSpanSeconds",
           "serverCpuLifecycleMeanPercentOneCore", "serverCpuLifecyclePeakIntervalPercentOneCore",
           "serverLifecyclePeakWorkingSetMiB", "serverLifecyclePeakOsThreads", "serverSampleSpanSeconds",
           "nodeWholeRunEventLoopP95Ms", "validationP95Ms", "stompConnectP95Ms", "paceCeilingPercent")


def nearest_rank(values, fraction):
    require(bool(values) and 0 < fraction <= 1, "Invalid percentile sample/fraction")
    return sorted(values)[math.ceil(fraction * len(values)) - 1]


def three_runs(values):
    require(len(values) == 3 and all(math.isfinite(value) for value in values), "Exactly three finite run metrics required")
    return {"values": list(values), "median": statistics.median(values), "min": min(values), "max": max(values)}


def relative_change(bounded, direct):
    require(direct > 0, "Direct denominator must be positive")
    return 100 * (bounded / direct - 1)


def completion_bins(cohort, window, bin_ms=1000):
    require(math.isclose(window["end"] - window["start"], 60000, rel_tol=0, abs_tol=1e-6)
            and bin_ms == 1000, "Only predefined 60 one-second bins supported")
    counts = [0] * 60
    for row in cohort:
        at = float(row["terminalMonoMs"])
        if window["start"] <= at < window["end"]:
            # A sub-ULP difference at end can round the subtraction to exactly 60s.
            counts[min(59, int((at - window["start"]) // bin_ms))] += 1
    return counts


def checksums(folder):
    return {str(p.relative_to(folder)).replace("\\", "/"): file_digest(p)
            for p in sorted(folder.rglob("*")) if p.is_file()}


def write_csv(path, rows):
    require(bool(rows), "Refusing empty CSV")
    with path.open("x", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)


def analyze(evidence, reliability, database_check):
    audited = matrix_audit(evidence)
    rel = reliability_audit(reliability)
    matrix = load_json(evidence / "matrix_results.json")
    require(audited["completedRuns"] == 18 and audited["completeMatrix"], "Incomplete performance matrix")
    require(rel["status"] == "PASS" and rel["caseCount"] == 7, "Reliability audit incomplete")
    require(audited["database"] == rel["database"] == matrix["databaseBaseline"]["database"], "Database identity mismatch")
    require(audited["jarSha256"] == rel["jarSha256"], "Reliability/performance binaries differ")
    check = load_json(database_check)
    require(check["snapshot"] == matrix["databaseBaseline"] and check["databaseUnchanged"], "X01.6 live database check differs from baseline")
    runs, exclusions, timeline = [], [], []
    pooled = defaultdict(list)
    for source in audited["runs"]:
        folder = evidence / f"benchmark-{source['clients']}-{source['mode']}-r{source['repeat']}"
        summary = load_json(folder / "runner/summary.json")
        labelled = [r for r in csv_rows(folder / "runner/raw.csv") if r["phase"] == "measurement"]
        window = summary["windows"]["measurement"]
        cohort, outside = select_cohort(labelled, window)
        values = [float(r["latencyMs"]) for r in cohort]
        require(all(math.isfinite(x) and x >= 0 for x in values), "Invalid latency")
        equal_number(statistics.median(values), source["medianMs"], "Raw/auditor median differs")
        equal_number(nearest_rank(values, .95), source["p95Ms"], "Raw/auditor P95 differs")
        node_samples = [r for r in csv_rows(folder / "runner/runner-resources.csv") if window["start"] <= float(r["monoMs"]) < window["end"]]
        server_samples = csv_rows(folder / "server-resources.csv")
        node_span = (float(node_samples[-1]["monoMs"]) - float(node_samples[0]["monoMs"])) / 1000
        server_span = (float(server_samples[-1]["samplerElapsedMs"]) - float(server_samples[0]["samplerElapsedMs"])) / 1000
        require(58 <= node_span <= 60 and server_span > 60, "Resource sample coverage needs investigation")
        run = {"clients": source["clients"], "mode": source["mode"], "repeat": source["repeat"],
            "cohortRequests": len(cohort), "labelledRequests": len(labelled), "outOfWindowSends": len(outside),
            "completedInsideWindow": source["completedInsideWindow"], "completedAfterWindow": source["completedAfterWindow"],
            "errors": source["errors"], "successRate": 1.0,
            "medianMs": statistics.median(values), "p95Ms": nearest_rank(values, .95), "p99Ms": nearest_rank(values, .99),
            "meanMs": statistics.mean(values), "maxMs": max(values),
            "throughputPerSecond": source["throughputPerSecond"], "sentRatePerSecond": source["sentRatePerSecond"],
            "nodeCpuMeanPercentOneCore": source["nodeCpuMeasurement"]["meanPercentOneCore"],
            "nodeCpuPeakIntervalPercentOneCore": source["nodeCpuMeasurement"]["maxSamplePercentOneCore"],
            "nodePeakRssMiB": source["nodePeakMeasurementRssBytes"] / MIB, "nodeSampleSpanSeconds": node_span,
            "serverCpuLifecycleMeanPercentOneCore": source["serverCpuWholeLifecycle"]["meanPercentOneCore"],
            "serverCpuLifecyclePeakIntervalPercentOneCore": source["serverCpuWholeLifecycle"]["maxSamplePercentOneCore"],
            "serverLifecyclePeakWorkingSetMiB": source["serverPeakRssBytesWholeLifecycle"] / MIB,
            "serverLifecyclePeakOsThreads": source["serverPeakOsThreadsWholeLifecycle"], "serverSampleSpanSeconds": server_span,
            "nodeWholeRunEventLoopP95Ms": summary["eventLoopDelayMs"]["p95"],
            "validationP95Ms": nearest_rank([float(r["validationMs"]) for r in cohort], .95),
            "stompConnectP95Ms": nearest_rank([r["stompConnectedMs"] for r in summary["connections"]], .95),
            "paceCeilingPercent": 100 * source["throughputPerSecond"] / (source["clients"] * 5),
            "distinctInputCases": len({r["inputCase"] for r in cohort}), "databaseUnchanged": True,
            "strictSendWindowSatisfied": not outside}
        runs.append(run)
        pooled[(source["clients"], source["mode"])].extend(values)
        for row in outside:
            exclusions.append({"clients": source["clients"], "mode": source["mode"], "repeat": source["repeat"],
                "requestId": row["requestId"], "clientId": row["clientId"],
                "outsideByMs": float(row["sendMonoMs"]) - window["end"], "latencyMs": float(row["latencyMs"]),
                "status": row["status"], "reason": "SEND timestamp outside predefined [start,end); original row retained"})
        bins = completion_bins(cohort, window)
        require(sum(bins) == run["completedInsideWindow"], "Timeline/throughput counts differ")
        timeline.extend({"clients": source["clients"], "mode": source["mode"], "repeat": source["repeat"],
                         "secondStart": i, "completedInOneSecond": value} for i, value in enumerate(bins))
    groups, differences = [], []
    for clients in CLIENTS:
        for mode in MODES:
            subset = sorted([r for r in runs if r["clients"] == clients and r["mode"] == mode], key=lambda r: r["repeat"])
            require([r["repeat"] for r in subset] == [1, 2, 3], "Missing repetition")
            groups.append({"clients": clients, "mode": mode, "runs": 3,
                "cohortRequests": sum(r["cohortRequests"] for r in subset), "errors": sum(r["errors"] for r in subset),
                "metrics": {key: three_runs([r[key] for r in subset]) for key in METRICS}})
        direct, bounded = groups[-2:]
        differences.append({"clients": clients, **{key + "ChangePercent": relative_change(bounded["metrics"][key]["median"], direct["metrics"][key]["median"])
                                                   for key in ("medianMs", "p95Ms", "throughputPerSecond")}})
    require(sum(r["cohortRequests"] for r in runs) == audited["totals"]["measurement"], "Aggregate count differs")
    return {"task": "X01.6", "status": "ANALYSIS_READY_FOR_REVIEW", "createdAt": datetime.now(VIETNAM).isoformat(),
        "evidenceDirectory": str(evidence.relative_to(ROOT)).replace("\\", "/"),
        "reliabilityDirectory": str(reliability.relative_to(ROOT)).replace("\\", "/"),
        "database": audited["database"], "jarSha256": audited["jarSha256"],
        "matrixAuditStatus": audited["status"], "strictSendWindowSatisfied": audited["strictSendWindowSatisfied"],
        "totals": audited["totals"], "runs": runs, "groups": groups, "differences": differences,
        "boundaryExclusions": exclusions, "databaseCheck": check,
        "reliabilitySummary": [{"suite": s["suite"], "casesPassed": len(s["cases"]), "rawCounts": s["rawCounts"]} for s in rel["suites"]],
        "definitions": {"cohort": "Measurement SEND timestamp in [start,end), unchanged original raw",
            "quantiles": "Nearest-rank per run; group median/min/max across three independent run summaries",
            "ranges": "Observed min-max of three runs, not confidence intervals",
            "pooledECDF": "Pooled cohort requests across three runs, descriptive only, separate from median-of-run metrics",
            "cpu": "Percent of one logical core, weighted by sampled elapsed time; can exceed 100",
            "serverResources": "Whole observed JVM lifecycle including startup/JIT/warmup; not isolated 60s steady state",
            "nodeResources": "Only sample timestamps inside measurement window; first-last spans recorded explicitly",
            "eventLoopDelay": "Node monitorEventLoopDelay at 20ms resolution, all phases including connect/warmup",
            "cpuPostgres": "Not sampled as a separate process"}}, pooled, timeline


def figures(report, pooled, timeline, output):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.lines import Line2D
    from matplotlib.ticker import ScalarFormatter
    import numpy as np
    matplotlib.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False,
        "axes.spines.right": False, "axes.titleweight": "bold", "axes.labelcolor": "#334155",
        "text.color": "#172638", "axes.edgecolor": "#9AA8B6", "svg.fonttype": "none",
        "savefig.facecolor": "white", "figure.facecolor": "white", "svg.hashsalt": "huyenco-x016"})
    output.mkdir(exist_ok=False)
    names = []
    def canvas(title, subtitle, nrows=1, ncols=2, height=6.2):
        fig, axes = plt.subplots(nrows, ncols, figsize=(12.8, height), squeeze=False)
        fig.subplots_adjust(left=.08, right=.975, bottom=.19 if nrows == 1 else .135,
                            top=.77 if nrows == 1 else .82, wspace=.28, hspace=.5)
        fig.text(.08, .94 if nrows == 1 else .96, title, fontsize=17, fontweight="bold")
        fig.text(.08, .885 if nrows == 1 else .92, subtitle, fontsize=9.3, color="#475569")
        for ax in axes.flat:
            ax.grid(axis="y", color="#DFE5EB", linewidth=.7); ax.set_axisbelow(True)
        return fig, axes
    def mode_legend(fig, y=.85):
        handles = [Line2D([], [], color=COLORS[m], marker="o" if m == "direct" else "D", linestyle="none", label=m) for m in MODES]
        fig.legend(handles=handles, loc="upper center", bbox_to_anchor=(.53, y), ncol=2, frameon=False)
    def save(fig, name, footnote):
        fig.text(.08, .045, textwrap.fill(footnote, 173), fontsize=8, color="#475569", va="bottom")
        for suffix in ("png", "svg"):
            fig.savefig(output / (name + "." + suffix), dpi=200)
        plt.close(fig); names.append(name)
    def grouped(ax, metric, title, ylabel):
        for j, mode in enumerate(MODES):
            for i, n in enumerate(CLIENTS):
                metric_data = next(g for g in report["groups"] if g["clients"] == n and g["mode"] == mode)["metrics"][metric]
                x = i + (-.115 if j == 0 else .115)
                low, med, high = metric_data["min"], metric_data["median"], metric_data["max"]
                ax.errorbar(x, med, yerr=[[med - low], [high - med]], fmt="o" if j == 0 else "D",
                    color=COLORS[mode], markersize=7, capsize=5, linewidth=1.7, zorder=4)
                ax.scatter([x - .035, x, x + .035], metric_data["values"], s=15,
                           color=COLORS[mode], alpha=.65, edgecolors="white", linewidths=.4, zorder=5)
        ax.set_xticks(range(3), [str(n) for n in CLIENTS]); ax.set_xlim(-.5, 2.5)
        ax.set_xlabel("Số Client STOMP"); ax.set_ylabel(ylabel); ax.set_title(title, loc="left", fontsize=11, pad=12)
        ax.set_ylim(bottom=0)

    fig, axes = canvas("Độ trễ yêu cầu LINES", "Cohort SEND trong [start, end) · 60 giây/lượt · 3 lượt/ô · cùng JAR và database TEST")
    grouped(axes[0, 0], "medianMs", "Median độ trễ của từng lượt", "Mili giây")
    grouped(axes[0, 1], "p95Ms", "P95 nearest-rank của từng lượt", "Mili giây")
    mode_legend(fig)
    save(fig, "01-latency", "Chấm nhỏ: 3 lượt riêng; dấu lớn: median; thanh: min–max quan sát, không phải khoảng tin cậy. Cohort loại 1 SEND muộn 0,022 ms; raw gốc được giữ nguyên. Nguồn: 18 lượt X01.4.")

    fig, axes = canvas("Throughput và nhịp gửi có kiểm soát", "Vòng kín: tối đa 1 request chưa xong/Client, nghỉ ít nhất 200 ms sau terminal; không đo tải cực đại")
    grouped(axes[0, 0], "throughputPerSecond", "Hoàn tất hợp lệ trong cửa sổ", "Request/giây")
    axes[0, 0].plot(range(3), [n * 5 for n in CLIENTS], color="#94A3B8", linestyle="--", marker="_", label="5 × số Client")
    axes[0, 0].set_ylim(0, 110)
    grouped(axes[0, 1], "paceCeilingPercent", "So với trần lý thuyết từ khoảng nghỉ", "% của 5 × số Client request/giây")
    axes[0, 1].axhline(100, color="#94A3B8", linestyle="--"); axes[0, 1].set_ylim(0, 105)
    mode_legend(fig)
    save(fig, "02-throughput", "Đường xám: trần do khoảng nghỉ, chưa kể thời gian xử lý/lập lịch. Dấu lớn: median của 3 lượt; thanh: min–max, không phải CI. Hai mode cùng nhịp gửi; throughput này không phải công suất tối đa Server.")

    fig, axes = canvas("Phân bố độ trễ quan sát được", "ECDF gộp request của 3 lượt trong từng ô · chỉ mô tả phân bố, không thay các chỉ số median theo lượt", ncols=3)
    for i, n in enumerate(CLIENTS):
        ax = axes[0, i]
        for mode in MODES:
            values = np.sort(pooled[(n, mode)])
            ax.step(values, np.arange(1, len(values) + 1) / len(values), where="post", color=COLORS[mode], linewidth=1.8,
                    linestyle="-" if mode == "direct" else "--")
        ax.set_xscale("log")
        ax.set_xlim(min(1, min(min(pooled[(n, m)]) for m in MODES) / 1.1),
                    max(100, max(max(pooled[(n, m)]) for m in MODES) * 1.1))
        ax.set_ylim(0, 1.02)
        ax.set_xticks([1, 2, 5, 10, 20, 50, 100]); ax.xaxis.set_major_formatter(ScalarFormatter())
        ax.axhline(.95, color="#94A3B8", linewidth=.8, linestyle=":")
        ax.set_xlabel("Độ trễ (ms), trục log"); ax.set_ylabel("Tỷ lệ request ≤ độ trễ")
        ax.set_title(f"{n} Client · n={len(pooled[(n, 'direct')]):,}/{len(pooled[(n, 'bounded')]):,}", fontsize=10.5, loc="left")
    mode_legend(fig)
    save(fig, "03-latency-ecdf", "n trong mỗi ô theo thứ tự direct/bounded; đường ngang ở 95%. Hiển thị toàn bộ dải độ trễ trong bộ dữ liệu (không cắt outlier). P95 của ECDF gộp khác với median của 3 P95 theo lượt; không coi 46.027 request là 46.027 lượt thực nghiệm độc lập.")

    fig, axes = canvas("CPU và bộ nhớ của hai tiến trình", "Phạm vi khác nhau: Java lấy mẫu toàn vòng đời; Node chỉ lấy mẫu trong cửa sổ đo · mẫu khoảng 1 giây", nrows=2, height=9)
    grouped(axes[0, 0], "serverCpuLifecycleMeanPercentOneCore", "Java: CPU trung bình toàn vòng đời được lấy mẫu", "% của một logical core")
    grouped(axes[0, 1], "nodeCpuMeanPercentOneCore", "Node: CPU trung bình mẫu trong cửa sổ đo", "% của một logical core")
    grouped(axes[1, 0], "serverLifecyclePeakWorkingSetMiB", "Java: peak working set được lấy mẫu", "MiB")
    grouped(axes[1, 1], "nodePeakRssMiB", "Node: peak RSS được lấy mẫu trong cửa sổ", "MiB")
    mode_legend(fig, .90)
    save(fig, "04-resources", "Dấu lớn: median 3 chỉ số theo lượt; thanh: min–max. CPU có thể vượt 100% khi dùng nhiều core; không phải % toàn máy. Java gồm startup/JIT/warm-up, không dùng để kết luận CPU/RAM steady state. Chưa đo CPU riêng của PostgreSQL.")

    fig, axes = canvas("Diễn biến throughput ở 20 Client", "Mỗi đường là một lượt; mỗi điểm là số kết quả thuộc cohort nhận trong 1 giây · không làm mượt")
    repeat_colors = ["#155E89", "#479B80", "#B26629"]
    for j, mode in enumerate(MODES):
        ax = axes[0, j]
        for repeat in (1, 2, 3):
            rows = [r for r in timeline if r["clients"] == 20 and r["mode"] == mode and r["repeat"] == repeat]
            ax.plot([r["secondStart"] + .5 for r in rows], [r["completedInOneSecond"] for r in rows],
                    color=repeat_colors[repeat - 1], linewidth=1.15, linestyle=["-", "--", ":"][repeat - 1], label=f"Lần {repeat}")
        ax.set_xlim(0, 60); ax.set_ylim(0, 110); ax.set_xlabel("Giây từ đầu cửa sổ đo")
        ax.set_ylabel("Hoàn tất/giây"); ax.set_title(mode, loc="left", fontsize=12)
    fig.legend(*axes[0, 0].get_legend_handles_labels(), loc="upper center", bbox_to_anchor=(.53, .85), ncol=3, frameon=False)
    save(fig, "05-throughput-timeline", "Các bin [0,1), …, [59,60) chỉ đếm kết quả của SEND thuộc cohort, không gồm warm-up/readiness hoặc SEND muộn. Giữ cả ba đường; không suy ra hàng đợi đầy hay độ trễ từ số đếm mỗi giây.")
    return names


def vn(value, digits=2):
    return f"{value:,.{digits}f}".replace(",", "_").replace(".", ",").replace("_", ".")


def metric_text(group, key, digits=2):
    metric = group["metrics"][key]
    return f"{vn(metric['median'], digits)} [{vn(metric['min'], digits)}–{vn(metric['max'], digits)}]"


def report_markdown(report, figures_prefix, tables_prefix):
    lines = ["# X01.6 — Tổng hợp, biểu đồ và phân tích benchmark", "",
        "**Hoàn thành phân tích ngày 29/10/2026.** Đủ 18 lượt 2/5/20 Client × direct/bounded × 3 lần; tính lại từ raw theo cohort SEND. Một SEND muộn 0,022 ms được công bố và giữ trong dữ liệu gốc. Kết quả quá tải/idempotency X01.5 được đối chiếu riêng, không nhập vào mẫu hiệu năng.", "",
        "## 1. Phương pháp và chất lượng dữ liệu", "",
        "Mỗi lượt đo dùng cùng JAR/JDK17/database TEST V12, warm-up 10 giây, cửa sổ 60 giây, UUID mới, một request chưa terminal/Client và nghỉ tối thiểu 200 ms. Chỉ đổi chế độ điều phối; bounded có 4 worker và queue 100. Mỗi ô có ba lần, thứ tự cân bằng theo kế hoạch 47, JVM mới cho mỗi lượt. Đây là LINES thật qua STOMP/JDBC trên loopback, không đo thao tác/render UI hoặc LAN.", "",
        f"Database `{report['database']}`; JAR SHA-256 `{report['jarSha256']}`. Raw được auditor đối chiếu trước khi phân tích; hash mọi file đầu vào được kiểm lại sau khi tạo artifact. Không chạy lại benchmark để chọn số đẹp.", "",
        "Cohort gồm SEND trong **[start,end)**. Latency là terminal-received trừ SEND trên cùng đồng hồ đơn điệu; median/P95/P99 chỉ tính COMPLETED hợp lệ. P95/P99 dùng nearest-rank. Throughput là số kết quả thuộc cohort nhận trước end chia 60 giây. Offered/sent rate là SEND thuộc cohort chia 60; trong bộ số liệu này hai rate bằng nhau vì tất cả kết quả cohort về trong cửa sổ.", "",
        "**Bảng tổng hợp dùng median của ba chỉ số theo lượt.** Dấu ngoặc vuông là min–max của ba lượt, không phải khoảng tin cậy. Không lấy trung bình ba P95; không trộn replay/từ chối nhanh vào latency tính mới. Mỗi điểm nhỏ trên hình là một lượt; các điểm có cùng giá trị có thể chồng nhau.", "",
        f"Đối soát: **{vn(report['totals']['measurement'], 0)} SEND cohort = {vn(report['totals']['measurement'], 0)} COMPLETED; 0 lỗi, 0 kết quả cohort thu nốt**. Toàn raw gồm {vn(report['totals']['readiness'], 0)} readiness + {vn(report['totals']['warmup'], 0)} warm-up + {vn(report['totals']['measurement'], 0)} cohort + 1 SEND ngoài ranh = {vn(report['totals']['completed'], 0)} COMPLETED/{vn(report['totals']['progress'], 0)} progress.", "",
        "Lượt 20 Client/bounded/lần 1 có 5.684 dòng gắn nhãn measurement nhưng 5.683 SEND đúng cửa sổ. Dòng muộn giữ nguyên và loại nhất quán theo timestamp, không dựa vào độ trễ/kết quả. Audit vẫn là `COHORT_AUDIT_PASS_WITH_WINDOW_DEVIATION`, `strictSendWindowSatisfied=false`. Nếu yêu cầu strict-window tuyệt đối cho bản chạy gốc, cần một ma trận mới với runner đã sửa; phân tích này không biến sai lệch đó thành PASS tuyệt đối.", "",
        "## 2. Độ trễ và throughput", "",
        "| Client | Mode | Tổng cohort | Median latency (ms) | P95 (ms) | Throughput (request/s) |", "| --- | --- | ---: | ---: | ---: | ---: |"]
    for group in report["groups"]:
        lines.append(f"| {group['clients']} | {group['mode']} | {vn(group['cohortRequests'], 0)} | {metric_text(group, 'medianMs')} | {metric_text(group, 'p95Ms')} | {metric_text(group, 'throughputPerSecond')} |")
    lines += ["", f"![Median và P95 của 18 lượt]({figures_prefix}/01-latency.png)", "",
        f"![Throughput và nhịp gửi]({figures_prefix}/02-throughput.png)", "",
        "So sánh dưới đây chỉ là phần trăm thay đổi của median theo ô: `(bounded/direct − 1) × 100`. Với latency/P95, số âm là giảm; với throughput, số dương là tăng. Không gọi đây là ước lượng hiệu ứng có ý nghĩa thống kê.", "",
        "| Client | Thay đổi median latency | Thay đổi P95 | Thay đổi throughput |", "| --- | ---: | ---: | ---: |"]
    for row in report["differences"]:
        lines.append(f"| {row['clients']} | {vn(row['medianMsChangePercent'])}% | {vn(row['p95MsChangePercent'])}% | {vn(row['throughputPerSecondChangePercent'])}% |")
    lines += ["", "Ở 2 và 5 Client, các khoảng đo chồng lấn và thay đổi nhỏ, không đồng nhất giữa median và P95. Ở 20 Client, bounded có median latency thấp hơn khoảng 14,71%, P95 thấp hơn khoảng 1,96% và throughput cao hơn khoảng 0,39% trong mẫu đã đo. Các khoảng của hai mode vẫn chồng lấn; ba lần đo chưa đủ để kết luận bounded luôn nhanh hơn hoặc khác biệt có ý nghĩa thống kê.", "",
        "Khoảng nghỉ 200 ms tạo trần lý thuyết 5 request/s/Client, tức 10/25/100 request/s trước khi tính thời gian xử lý/lập lịch. Throughput khoảng 94–95 request/s ở 20 Client phản ánh workload vòng kín này, **không phải công suất cực đại**. Không ngoại suy tuyến tính sang 100/1.000 Client hoặc dùng số này làm cam kết chịu tải.", "",
        "## 3. Phân bố và diễn biến trong cửa sổ", "", f"![ECDF độ trễ]({figures_prefix}/03-latency-ecdf.png)", "",
        f"![Throughput từng giây ở 20 Client]({figures_prefix}/05-throughput-timeline.png)", "",
        "ECDF gộp request của ba lượt chỉ dùng mô tả phân bố trong từng ô; nó không thay bảng median/P95 theo lượt và không biến các request có phụ thuộc theo phiên/thời gian thành các lượt độc lập. Trục X là log và hiển thị toàn bộ dải độ trễ quan sát, không cắt outlier. Biểu đồ theo giây giữ ba đường của 20 Client và không làm mượt; tổng 60 bin được kiểm lại bằng số hoàn tất trong cửa sổ.", "",
        "| Client | Mode | Median P99 theo lượt, min–max (ms) | Max latency lớn nhất (ms) | P95 xác thực response tại runner, median (ms) |", "| --- | --- | ---: | ---: | ---: |"]
    for group in report["groups"]:
        lines.append(f"| {group['clients']} | {group['mode']} | {metric_text(group, 'p99Ms')} | {vn(group['metrics']['maxMs']['max'])} | {vn(group['metrics']['validationP95Ms']['median'], 3)} |")
    distinct = sorted({run["distinctInputCases"] for run in report["runs"]})
    lines += ["", f"Mỗi lượt đo phủ **{', '.join(map(str, distinct))} cặp inputCase** theo seed benchmark, không phải toàn bộ 384 tổ hợp sáu hào/hào động. Đây là giới hạn của chu kỳ seed; kiểm đầy đủ chức năng 384 tổ hợp thuộc bộ nghiệm thu nghiệp vụ riêng. Thời gian xác thực response được ghi riêng; latency đánh dấu tại lúc callback nhận terminal, trước khi chạy oracle. Chi phí callback/validation vẫn có thể tác động lịch gửi tiếp theo.", "",
        "## 4. CPU, bộ nhớ và thread", "", f"![CPU và bộ nhớ]({figures_prefix}/04-resources.png)", "",
        "CPU tính bằng `100 × ΔCPU_time / Δelapsed`, dùng đơn vị thời gian thống nhất và trọng số theo khoảng lấy mẫu; đơn vị là **% của một logical core**, có thể vượt 100%. Không chia nhầm cho toàn máy hoặc lấy trung bình không trọng số các khoảng khác nhau. Các peak là peak được lấy mẫu khoảng một giây, không bảo đảm bắt được đỉnh ngắn hơn.", "",
        "Node chỉ dùng các mốc sample nằm trong cửa sổ đo; khoảng mẫu đầu–cuối gần 59 giây được lưu từng lượt. Java dùng toàn vòng đời được lấy mẫu, **gồm startup/JIT/warm-up**, vì artifact không có mốc đồng hồ đơn điệu chung đủ chính xác để tách riêng cửa sổ Java 60 giây. Không ghép CPU hai phạm vi thành tổng, không coi working set là heap used hoặc heap limit. CPU PostgreSQL chưa được lấy mẫu riêng.", "",
        "Các ô dưới đây là median [min–max] của ba chỉ số theo lượt. Peak OS thread là thread toàn tiến trình Java trên Windows, không phải số worker hay Java managed thread qua JMX.", "",
        "| Client | Mode | Java CPU vòng đời (% 1 core) | Java peak working set (MiB) | Java peak OS thread | Node CPU cửa sổ (% 1 core) | Node peak RSS cửa sổ (MiB) |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |"]
    for group in report["groups"]:
        lines.append(f"| {group['clients']} | {group['mode']} | {metric_text(group, 'serverCpuLifecycleMeanPercentOneCore')} | {metric_text(group, 'serverLifecyclePeakWorkingSetMiB')} | {metric_text(group, 'serverLifecyclePeakOsThreads', 0)} | {metric_text(group, 'nodeCpuMeanPercentOneCore')} | {metric_text(group, 'nodePeakRssMiB')} |")
    node_max = max(r["nodeCpuPeakIntervalPercentOneCore"] for r in report["runs"])
    java_peak = max(r["serverLifecyclePeakWorkingSetMiB"] for r in report["runs"])
    event_min = min(r["nodeWholeRunEventLoopP95Ms"] for r in report["runs"])
    event_max = max(r["nodeWholeRunEventLoopP95Ms"] for r in report["runs"])
    lines += ["", f"Không thấy CPU runner bão hòa trong mẫu: khoảng CPU Node cao nhất là {vn(node_max)}% của một core; Java peak working set lớn nhất {vn(java_peak)} MiB. Tuy vậy CPU trung bình thấp không chứng minh event loop/lập lịch không ảnh hưởng latency. `monitorEventLoopDelay` có resolution 20 ms và phạm vi toàn lượt gồm connect/warm-up; P95 ghi nhận khoảng {vn(event_min)}–{vn(event_max)} ms, không dùng làm độ trễ event loop riêng của cửa sổ hoặc so trực tiếp với request latency vài ms. Chi tiết có trong CSV từng lượt.", "",
        "Bounded giới hạn bốn phép tính trong dispatcher, không giới hạn tổng thread ứng dụng thành bốn: Spring/WebSocket/JDBC/deadline/JVM còn có thread riêng. CPU/RAM vòng đời của hai mode chịu startup/JIT, GC, cache hệ điều hành và tác vụ khác trên cùng máy; bộ số liệu chưa cho phép kết luận mức tiết kiệm tài nguyên steady state của bounded.", "",
        "## 5. Độ tin cậy và đối soát database", "",
        "Trong ma trận hiệu năng không có SERVER_BUSY/timeout/lỗi DB/lỗi nguồn/transport/protocol hoặc sai phiên/kết quả. Điều này chỉ áp dụng mức tải đã đo: tối đa 20 việc chưa terminal so với queue 100, chưa chứng minh queue đầy.", "",
        "X01.5 kiểm riêng 7/7 ca qua STOMP/PostgreSQL thật: in-flight dedupe, replay không progress, xung đột payload không đổi kết quả gốc, 20 phiên cùng ID/input khác, TTL mặc định 60 giây, reconnect và quá tải/phục hồi. Với cấu hình stress 2 worker/queue 4, burst tự nhiên 160 yêu cầu có 10 COMPLETED/150 SERVER_BUSY; ca khóa database ngắn có kiểm soát có 6 COMPLETED/154 SERVER_BUSY và hai JDBC waiter được quan sát. ID bị từ chối được gửi lại thành công. Đó là fault injection riêng, không đưa thời gian từ chối/replay/giữ khóa vào bảng hiệu năng.", "",
        f"18 cặp snapshot trước/sau đo đều khớp baseline. Kiểm chỉ đọc sau đo cho X01.6 tại **{report['databaseCheck']['capturedAt']}** tiếp tục khớp toàn bộ 16 bảng tri thức/migration và schema; hai bảng phiên/lịch sử giữ 0 dòng. Knowledge hash `{report['databaseCheck']['snapshot']['knowledgeSha256']}`, schema hash `{report['databaseCheck']['snapshot']['schemaSha256']}`. Không import/migrate hoặc thay dữ liệu để phân tích.", "",
        "## 6. Giới hạn và ý nghĩa kỹ thuật", "",
        "Kết quả hỗ trợ việc giữ bounded làm cấu hình mặc định để điều phối có giới hạn, kết hợp bằng chứng từ chối có kiểm soát/phục hồi ở X01.5. Kết quả không yêu cầu bounded phải thắng direct ở mọi chỉ số. Cả hai mode cùng có idempotency, vì vậy chênh lệch hai mode không đo lợi ích riêng của cache/dedupe.", "",
        "Ba lượt/ô, cùng máy loopback, cùng dataset và tải có khoảng nghỉ là phạm vi thực nghiệm. Mỗi lượt có JVM mới nhưng PostgreSQL/OS cache không bị xóa; thứ tự cân bằng giảm thiên lệch thứ tự, không loại hết yếu tố gây nhiễu. Không suy rộng sang TIME/Tam Thế/lời luận chi tiết/REST/history, nhiều máy, mạng chậm, phần cứng khác, độ bền qua crash hoặc tải mở không có khoảng nghỉ. Không báo p-value/CI hoặc khẳng định tương đương thống kê từ các khoảng min–max.", "",
        "Sai lệch SEND muộn 0,022 ms vẫn là giới hạn kiểm soát của ma trận gốc. Sửa runner và smoke sau sửa có bằng chứng riêng, không thay lượt chính thức hoặc xóa dòng ngoài ranh. Nếu giảng viên yêu cầu ma trận strict-window tuyệt đối thì cần đo mới, không chỉ sửa báo cáo.", "",
        "## 7. Artifact và tái lập", "",
        f"- [Chỉ số đủ 18 lượt]({tables_prefix}/per-run.csv): median/P95/P99/mean/max, offered/throughput, sample count, ranh thời gian và tài nguyên/phạm vi.",
        f"- [Tổng hợp sáu ô]({tables_prefix}/aggregate.csv): ba giá trị gốc theo thứ tự lần 1/2/3, median/min/max.",
        f"- [Chênh lệch mô tả bounded/direct]({tables_prefix}/differences.csv); [số hoàn tất theo giây]({tables_prefix}/timeline.csv); [SEND ngoài ranh]({tables_prefix}/boundary-exclusions.csv).",
        f"- [Manifest bản bàn giao]({tables_prefix}/publication-manifest.json): hash artifact, nguồn dữ liệu và phiên bản công cụ; PNG để chèn báo cáo, SVG cùng tên để xuất nét.", "",
        "Công cụ `scripts/summarize_x01_benchmark.py` đọc raw và gọi lại auditor, tạo một thư mục `scripts/generated/x01_analysis_<timestamp>/` mới, lưu JSON/CSV/PNG/SVG cùng hash đầu vào/đầu ra và snapshot mã phân tích. Thư mục raw X01.4/X01.5 được giữ nguyên. Chạy lại offline bằng Python có Matplotlib/NumPy:", "",
        "```powershell", "python .\\scripts\\summarize_x01_benchmark.py", "```", "",
        "Thêm `--publish` để cập nhật các bảng/ảnh đã rà soát trong `docs/assets/x01/` và tài liệu này. Không khởi động Server, không tự đo thêm và không ghi PostgreSQL. Kiểm database trực tiếp là bước chỉ đọc riêng; công cụ dùng file kiểm đã ghi nhận trong manifest, không yêu cầu lưu mật khẩu trong repo.", "",
        "**X01.6 đã hoàn thành tổng hợp/biểu đồ/phân tích trong phạm vi dữ liệu hiện có. Tiếp theo X01.7 — đưa Experimental Setup, Results, Discussion và liên kết bằng chứng vào báo cáo nộp; chưa đóng toàn task X01 hoặc tiêu chí strict-window của X01.4.**", ""]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence")
    parser.add_argument("--reliability")
    parser.add_argument("--database-check")
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    evidence = generated_path(args.evidence or load_json(GENERATED / "x01_official_matrix_target.json")["evidenceDirectory"])
    reliability = generated_path(args.reliability or load_json(GENERATED / "x01_reliability_completed.json")["evidenceDirectory"])
    db_check = generated_path(args.database_check or load_json(GENERATED / "x01_analysis_dbcheck_target.json")["path"])
    input_pins = {"matrix": checksums(evidence), "reliability": checksums(reliability), "databaseCheckSha256": file_digest(db_check)}
    report, pooled, timeline = analyze(evidence, reliability, db_check)
    folder = GENERATED / ("x01_analysis_" + datetime.now(VIETNAM).strftime("%Y%m%d_%H%M%S_%f"))
    folder.mkdir(exist_ok=False)
    report["analysisDirectory"] = str(folder.relative_to(ROOT)).replace("\\", "/")
    report["databaseCheckPath"] = str(db_check.relative_to(ROOT)).replace("\\", "/")
    write_new_json(folder / "input_checksums.json", input_pins)
    write_new_json(folder / "matrix_audit.json", matrix_audit(evidence))
    write_new_json(folder / "reliability_audit.json", reliability_audit(reliability))
    tables = folder / "tables"; tables.mkdir()
    write_csv(tables / "per-run.csv", report["runs"])
    aggregate = []
    for group in report["groups"]:
        row = {key: group[key] for key in ("clients", "mode", "runs", "cohortRequests", "errors")}
        for key, metric in group["metrics"].items():
            row.update({key + "_r" + str(i + 1): value for i, value in enumerate(metric["values"])})
            row.update({key + "_" + stat: metric[stat] for stat in ("median", "min", "max")})
        aggregate.append(row)
    write_csv(tables / "aggregate.csv", aggregate)
    write_csv(tables / "differences.csv", report["differences"])
    write_csv(tables / "timeline.csv", timeline)
    if report["boundaryExclusions"]: write_csv(tables / "boundary-exclusions.csv", report["boundaryExclusions"])
    names = figures(report, pooled, timeline, folder / "figures")
    report["figures"] = names
    import matplotlib, numpy
    report["analysisToolchain"] = {"python": sys.version, "matplotlib": matplotlib.__version__, "numpy": numpy.__version__}
    source_names = ["scripts/summarize_x01_benchmark.py", "scripts/audit_x01_matrix.py", "scripts/audit_x01_reliability.py",
                    "scripts/run_x01_benchmark.py", "scripts/run_x01_reliability.py", "scripts/run_x01_matrix.py", "scripts/prepare_x01_test_database.py"]
    source_pins = {}
    for name in source_names:
        destination = folder / "analysis_source" / name
        destination.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(ROOT / name, destination)
        source_pins[name] = file_digest(destination)
    report["sourcePins"] = source_pins
    (folder / "report.md").write_text(report_markdown(report, "figures", "tables"), encoding="utf-8")
    require(input_pins == {"matrix": checksums(evidence), "reliability": checksums(reliability), "databaseCheckSha256": file_digest(db_check)}, "Input evidence changed during analysis")
    report["originalInputsUnchanged"] = True
    write_new_json(folder / "analysis.json", report)
    if args.publish:
        destination = ROOT / "docs/assets/x01"
        destination.mkdir(parents=True, exist_ok=True)
        for source in list((folder / "figures").iterdir()) + list(tables.iterdir()): shutil.copy2(source, destination / source.name)
        publication = {"task": "X01.6", "status": "GENERATED_PENDING_VISUAL_REVIEW", "analysisDirectory": report["analysisDirectory"],
            "matrixAuditStatus": report["matrixAuditStatus"], "strictSendWindowSatisfied": report["strictSendWindowSatisfied"],
            "cohortRequests": report["totals"]["measurement"], "originalInputsUnchanged": True,
            "sourcePins": source_pins, "analysisToolchain": report["analysisToolchain"],
            "files": {p.name: file_digest(p) for p in sorted(destination.iterdir()) if p.is_file() and p.name != "publication-manifest.json"}}
        (destination / "publication-manifest.json").write_text(json.dumps(publication, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        (ROOT / "docs/53-X01-BENCHMARK-ANALYSIS.md").write_text(report_markdown(report, "assets/x01", "assets/x01"), encoding="utf-8")
    write_new_json(folder / "output_checksums.json", checksums(folder))
    print(json.dumps({"status": report["status"], "analysisDirectory": report["analysisDirectory"], "runs": len(report["runs"]),
        "figures": len(names), "cohort": report["totals"]["measurement"], "publishedForReview": args.publish,
        "differences": report["differences"]}, ensure_ascii=False))


if __name__ == "__main__": main()
