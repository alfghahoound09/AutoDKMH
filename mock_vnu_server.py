import http.server
import json
import os
import re
import time
from urllib.parse import parse_qs, urlparse

PORT = 8080
WORKSPACE_DIR = r"d:\AutoDKMH"

# Danh sách học phần mở trong kỳ (Khớp 100% với Ảnh 3 & Ảnh 4 của bạn trên dangkyhoc.vnu.edu.vn)
DEFAULT_COURSES = [
    {
        "rowindex": "913",
        "name": "Giải tích 2",
        "credits": 5,
        "sub_col": "0",
        "class_code": "UET.MAT1051 2",
        "max_slots": 60,
        "enrolled": 59,
        "teacher": "ThS Thẩm Như Phong, GS.TSKH Phạm Hoàng Hiệp, ThS Thẩm Như Phong",
        "note": "",
        "schedule": "T5-(4-6)-201-G,T6-(10-12)-102-B,T7-(4-6)-204-G",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "914",
        "name": "Giải tích 2",
        "credits": 5,
        "sub_col": "0",
        "class_code": "UET.MAT1051 3",
        "max_slots": 60,
        "enrolled": 57,
        "teacher": "TS Nguyễn Năng Thiều, TS Nguyễn Năng Thiều, TS Nguyễn Năng Thiều",
        "note": "",
        "schedule": "T2-(10-12)-307-B,T3-(7-9)-501-B,T6-(4-6)-505-B",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "915",
        "name": "Giải tích 2",
        "credits": 5,
        "sub_col": "0",
        "class_code": "UET.MAT1051 4",
        "max_slots": 60,
        "enrolled": 51,
        "teacher": "KS Nguyễn Công Minh, KS Nguyễn Công Minh",
        "note": "",
        "schedule": "T6-(7-9)-105-B,T7-(4-6)-106-B",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "916",
        "name": "Giải tích 2",
        "credits": 5,
        "sub_col": "0",
        "class_code": "UET.MAT1051 5",
        "max_slots": 60,
        "enrolled": 52,
        "teacher": "KS Nguyễn Công Minh, KS Nguyễn Công Minh",
        "note": "",
        "schedule": "T2-(4-6)-509-B,T5-(7-9)-507-A",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "917",
        "name": "Giải tích 2",
        "credits": 5,
        "sub_col": "0",
        "class_code": "UET.MAT1051 6",
        "max_slots": 60,
        "enrolled": 27,
        "teacher": "TS Trần Thanh Hải, ThS Nguyễn Văn Tùng, ThS Nguyễn Văn Tùng",
        "note": "",
        "schedule": "T3-(7-9)-505-A,T4-(4-6)-202-A,T7-(4-6)-303-B",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "918",
        "name": "Giải tích 2",
        "credits": 5,
        "sub_col": "0",
        "class_code": "UET.MAT1051 7",
        "max_slots": 60,
        "enrolled": 32,
        "teacher": "ThS Thẩm Như Phong, ThS Thẩm Như Phong, ThS Thẩm Như Phong",
        "note": "",
        "schedule": "T2-(1-3)-109-B,T5-(1-3)-304-B,T7-(1-3)-402-B",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "919",
        "name": "Giải tích 2",
        "credits": 5,
        "sub_col": "0",
        "class_code": "UET.MAT1051 8",
        "max_slots": 48,
        "enrolled": 48,  # Lớp đầy 48/48 (ẩn checkbox .order, nền xám ô ĐK - cần Ghim Burst để săn slot!)
        "teacher": "ThS Dư Thành Hưng, ThS Dư Thành Hưng, ThS Dư Thành Hưng",
        "note": "",
        "schedule": "T4-(7-9)-102-A,T6-(1-3)-101-A,T6-(4-6)-101-A",
        "full_first_attempt": True,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "920",
        "name": "Giải tích 2",
        "credits": 5,
        "sub_col": "0",
        "class_code": "UET.MAT1051 9",
        "max_slots": 47,
        "enrolled": 47,  # Lớp đầy 47/47
        "teacher": "PGS.TS Lê Đức Việt, PGS.TS Lê Đức Việt, PGS.TS Lê Đức Việt",
        "note": "",
        "schedule": "T4-(7-9)-509-B,T5-(10-12)-405-A,T7-(4-6)-305-A",
        "full_first_attempt": True,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "921",
        "name": "Trí tuệ nhân tạo",
        "credits": 3,
        "sub_col": "",
        "class_code": "UET.CS2046 2",
        "max_slots": 60,
        "enrolled": 57,
        "teacher": "TS Nguyễn Đức Anh (CNPM)",
        "note": "",
        "schedule": "T2-(1-3)-204-G2",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "922",
        "name": "Trí tuệ nhân tạo",
        "credits": 3,
        "sub_col": "",
        "class_code": "UET.CS2046 3",
        "max_slots": 60,
        "enrolled": 56,
        "teacher": "TS Trần Mai Vũ",
        "note": "",
        "schedule": "T3-(4-6)-205-G2",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "923",
        "name": "Trí tuệ nhân tạo",
        "credits": 3,
        "sub_col": "",
        "class_code": "UET.CS2046 4",
        "max_slots": 60,
        "enrolled": 57,
        "teacher": "TS Trần Mai Vũ",
        "note": "",
        "schedule": "T5-(1-3)-301-G2",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "924",
        "name": "Trí tuệ nhân tạo",
        "credits": 3,
        "sub_col": "",
        "class_code": "UET.CS2046 5",
        "max_slots": 60,
        "enrolled": 57,
        "teacher": "TS Nguyễn Văn Sơn",
        "note": "",
        "schedule": "T6-(7-9)-305-G2",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "925",
        "name": "Trí tuệ nhân tạo",
        "credits": 3,
        "sub_col": "",
        "class_code": "UET.CS2046 6",
        "max_slots": 60,
        "enrolled": 61,  # Lớp đầy 61/60 như trong Ảnh 3
        "teacher": "Nguyễn Lưu Tú",
        "note": "",
        "schedule": "T4-(1-3)-103-A",
        "full_first_attempt": True,
        "attempts": 0,
        "status": "confirmed",  # Có sẵn trong bảng hồng bên dưới như Ảnh 3 & 4
    },
    {
        "rowindex": "926",
        "name": "Trí tuệ nhân tạo",
        "credits": 3,
        "sub_col": "",
        "class_code": "UET.CS2046 7",
        "max_slots": 60,
        "enrolled": 60,  # Lớp đầy 60/60 như trong Ảnh 3 (ẩn checkbox .order -> test Ghim Burst x25!)
        "teacher": "Nguyễn Lưu Tú",
        "note": "",
        "schedule": "T4-(4-6)-103-A",
        "full_first_attempt": True,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "930",
        "name": "Triết học Mác - Lênin",
        "credits": 3,
        "sub_col": "",
        "class_code": "PHI1006 10",
        "max_slots": 60,
        "enrolled": 55,
        "teacher": "",
        "note": "",
        "schedule": "T2-(7-9)-201-GĐ2",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "931",
        "name": "Triết học Mác - Lênin",
        "credits": 3,
        "sub_col": "",
        "class_code": "PHI1006 11",
        "max_slots": 60,
        "enrolled": 59,
        "teacher": "",
        "note": "",
        "schedule": "T3-(1-3)-201-GĐ2",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
    {
        "rowindex": "932",
        "name": "Kinh tế chính trị Mác - Lênin",
        "credits": 2,
        "sub_col": "",
        "class_code": "PEC1008 20",
        "max_slots": 50,
        "enrolled": 0,
        "teacher": "",
        "note": "",
        "schedule": "T3-(10-12)-206-A",
        "full_first_attempt": False,
        "attempts": 0,
        "status": "none",
    },
]

# Danh sách 6 môn đã đăng ký sẵn ở bảng hồng bên dưới (Khớp 100% Ảnh 3 & Ảnh 4)
BASE_REGISTERED_COURSES = [
    {
        "name": "Cơ sở dữ liệu",
        "credits": 3,
        "class_code": "UET.IS2099 20",
        "teacher": "TS Vương Thị Hải Yến",
        "schedule": "T6-(1-3)-308-B",
        "reg_type": "Đăng ký lần đầu",
    },
    {
        "name": "Lịch sử Đảng Cộng sản Việt Nam",
        "credits": 2,
        "class_code": "HIS1001 31",
        "teacher": "",
        "schedule": "T4-(4-6)-308-B",
        "reg_type": "Đăng ký lần đầu",
    },
    {
        "name": "Nhà nước và pháp luật đại cương",
        "credits": 2,
        "class_code": "THL1057 6",
        "teacher": "",
        "schedule": "CN-(7-9)-Học Online",
        "reg_type": "Đăng ký lần đầu",
    },
    {
        "name": "Trí tuệ nhân tạo",
        "credits": 3,
        "class_code": "UET.CS2046 6",
        "teacher": "Nguyễn Lưu Tú",
        "schedule": "T4-(1-3)-103-A",
        "reg_type": "Đăng ký lần đầu",
    },
    {
        "name": "Vật lý đại cương 2",
        "credits": 3,
        "class_code": "UET.PHY1096 20",
        "teacher": "PGS.TS Lê Việt Cường, ThS Trần Đức Đông",
        "schedule": "T6-(7-9)-303-A,T6-(4-6)-308-B",
        "reg_type": "Đăng ký lần đầu",
    },
    {
        "name": "Xác suất thống kê",
        "credits": 3,
        "class_code": "UET.MAT1052 20",
        "teacher": "PGS.TS Đặng Thanh Hải",
        "schedule": "T3-(10-12)-105-B",
        "reg_type": "Đăng ký lần đầu",
    },
]

courses_state = [dict(c) for c in DEFAULT_COURSES]

# Các chế độ mô phỏng giống hệt các ảnh chụp thực tế của bạn:
#   - 'normal'          : Mở cổng ĐKMH (Ảnh 3 - Bảng xanh lá + Nút Ghi nhận + Bảng hồng + Thanh vàng đáy trang)
#   - 'out_of_time'     : Ngoài thời hạn đăng ký! (Ảnh 4 - Ẩn checkbox, hiện nút nâu "Ngoài thời hạn đăng ký!", Online: 408)
#   - 'portal_locked'   : Đang khóa đăng ký học (Ảnh lúc 22:22 - Hiện khung đỏ "Đang khóa đăng ký học, bạn vui lòng thử lại sau!", Online: 33)
#   - 'overload_503'    : Quá tải 2,386 user -> API trả về 503 "The service is unavailable." 2 chu kỳ đầu, chu kỳ 3 thông cổng!
#   - 'full_crash_503'  : Sập trắng trang "The service is unavailable."
#   - 'session_kicked'  : Đang chạy Auto thì bị văng phiên về /dang-nhap (Quay lại sau: 8phút)
#   - 'login_max_users' : Trang /dang-nhap báo "Hệ thống đã đạt đến giới hạn số người truy cập tối đa..." (Ảnh 2, Online: 2386)
sim_state = {
    "mode": "normal",
    "login_submode": "cooldown",  # normal | cooldown | max_users
    "online_users": 33,
    "probe_counter": 0,
    "recovery_pings": 0,
    "total_api_requests_received": 0,
}


def set_scenario(mode):
    sim_state["mode"] = mode
    sim_state["probe_counter"] = 0
    sim_state["recovery_pings"] = 0
    if mode == "normal":
        sim_state["online_users"] = 33
    elif mode == "out_of_time":
        sim_state["online_users"] = 408
    elif mode == "portal_locked":
        sim_state["online_users"] = 33
    elif mode in ("overload_503", "full_crash_503"):
        sim_state["online_users"] = 2386
    elif mode == "session_kicked":
        sim_state["online_users"] = 33
        sim_state["login_submode"] = "cooldown"
    elif mode == "login_max_users":
        sim_state["online_users"] = 2386
        sim_state["login_submode"] = "max_users"


def reset_state():
    global courses_state
    courses_state = [dict(c) for c in DEFAULT_COURSES]
    sim_state["total_api_requests_received"] = 0
    set_scenario("normal")


def render_dsdk_tbody_rows():
    """Render bảng #divDSDK giống hệt 10 cột của dangkyhoc.vnu.edu.vn (Ảnh 3 & Ảnh 4)."""
    rows_html = []
    is_out_of_time = sim_state["mode"] == "out_of_time"

    for c in courses_state:
        is_full = c["enrolled"] >= c["max_slots"]
        checked = "checked" if c["status"] in ("pending", "confirmed") else ""

        # Trên cổng VNU thật:
        # - Các dòng còn slot có nền vàng (#ffff99 ở Light Mode / #4c4d00 ở Dark Reader)
        # - Các dòng đã đầy (61/60, 60/60, 48/48) có nền trắng/đen và ô ĐK có nền xám đậm (#b5b5b5 / #474b4e)
        row_class = "vnu-row-full" if is_full else "vnu-row-open"
        dk_cell_class = "vnu-cell-dk-full" if is_full else "vnu-cell-dk"

        # Khi lớp đã đầy hoặc đang ở chế độ "Ngoài thời hạn đăng ký!", VNU ẩn thẻ <input class="order">
        if is_full or is_out_of_time:
            checkbox_html = ""
        else:
            checkbox_html = f'<input type="checkbox" class="order" data-rowindex="{c["rowindex"]}" {checked} />'

        rows_html.append(
            f"""
            <tr class="{row_class}">
              <td class="vnu-col-check">{checkbox_html}</td>
              <td>{c['name']}</td>
              <td style="text-align:center;">{c['credits']}</td>
              <td style="text-align:center;">{c['sub_col']}</td>
              <td>{c['class_code']}</td>
              <td style="text-align:center;">{c['max_slots']}</td>
              <td class="{dk_cell_class}" style="text-align:center;">{c['enrolled']}</td>
              <td>{c['teacher']}</td>
              <td>{c['note']}</td>
              <td>{c['schedule']}</td>
            </tr>
            """
        )
    return "\n".join(rows_html)


def render_registered_tbody_rows():
    """Render bảng xanh dương / dòng hồng 'Danh sách môn học đã đăng ký hoặc đã chọn' (Ảnh 3 & Ảnh 4)."""
    combined = [dict(item) for item in BASE_REGISTERED_COURSES]
    existing_codes = {item["class_code"] for item in combined}

    for c in courses_state:
        if c["status"] in ("pending", "confirmed") and c["class_code"] not in existing_codes:
            combined.append(
                {
                    "name": c["name"],
                    "credits": c["credits"],
                    "class_code": c["class_code"],
                    "teacher": c["teacher"],
                    "schedule": c["schedule"],
                    "reg_type": (
                        "Đăng ký lần đầu"
                        if c["status"] == "confirmed"
                        else "Mới chọn (chưa ghi nhận)"
                    ),
                }
            )

    rows_html = []
    total_credits = 0
    for idx, item in enumerate(combined, start=1):
        total_credits += int(item["credits"])
        rows_html.append(
            f"""
            <tr class="vnu-reg-row">
              <td style="text-align:center;">{idx}</td>
              <td>{item['name']}</td>
              <td style="text-align:center;">{item['credits']}</td>
              <td>{item['class_code']}</td>
              <td>{item['teacher']}</td>
              <td>{item['schedule']}</td>
              <td style="text-align:center;"><input type="checkbox" checked disabled /></td>
              <td style="text-align:center;"></td>
              <td>{item['reg_type']}</td>
              <td style="text-align:center;"></td>
            </tr>
            """
        )
    return "\n".join(rows_html), total_credits, len(combined)


VNU_LOGO_SVG = """
<div class="vnu-logo-box">
  <svg width="132" height="50" viewBox="0 0 132 50" xmlns="http://www.w3.org/2000/svg">
    <rect width="132" height="50" fill="#ffffff" rx="2"/>
    <circle cx="23" cy="23" r="16" fill="none" stroke="#1b7e3c" stroke-width="1.6"/>
    <path d="M11 26 Q23 18 35 26" fill="none" stroke="#1b7e3c" stroke-width="1.4"/>
    <line x1="13" y1="30" x2="33" y2="30" stroke="#1b7e3c" stroke-width="1.4"/>
    <line x1="15" y1="33" x2="31" y2="33" stroke="#1b7e3c" stroke-width="1.4"/>
    <text x="45" y="26" font-family="Arial, sans-serif" font-size="21" font-weight="900" fill="#1b7e3c">VNU</text>
    <polygon points="103,14 105,19 110,19 106,22 108,27 103,24 98,27 100,22 96,19 101,19" fill="#d97706"/>
    <text x="8" y="43" font-family="Arial, sans-serif" font-size="6.3" font-weight="700" fill="#1b7e3c">ĐẠI HỌC QUỐC GIA HÀ NỘI</text>
    <text x="8" y="49" font-family="Arial, sans-serif" font-size="5.2" fill="#1b7e3c">Vietnam National University, Hanoi</text>
  </svg>
</div>
"""


LOGIN_PAGE_HTML = """<!DOCTYPE html>
<html lang="vi" data-vnu-theme="dark">
<head>
  <meta charset="UTF-8">
  <title>Đăng nhập hệ thống đăng ký học</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --page-bg: #181a1b;
      --header-bg: #1b1d1e;
      --border-col: #34383a;
      --text-main: #e8e6e3;
      --text-sub: #b0aba3;
      --link-green: #52e372;
      --banner-yellow-bg: #585b00;
      --banner-yellow-text: #ffff66;
      --card-bg: #1b1d1e;
      --card-header-bg: #2b9348;
      --input-bg: #1e2229;
      --input-border: #3a3f45;
      --max-limit-bg: #3b3520;
      --max-limit-text: #d6c58b;
      --max-limit-border: #5c5230;
    }
    html[data-vnu-theme="light"] {
      --page-bg: #f5f5f5;
      --header-bg: #ffffff;
      --border-col: #dddddd;
      --text-main: #333333;
      --text-sub: #555555;
      --link-green: #1b7e3c;
      --banner-yellow-bg: #f2ec9b;
      --banner-yellow-text: #333333;
      --card-bg: #ffffff;
      --card-header-bg: #35aa47;
      --input-bg: #ffffff;
      --input-border: #cccccc;
      --max-limit-bg: #fcf8e3;
      --max-limit-text: #8a6d3b;
      --max-limit-border: #faebcc;
    }
    body {
      margin: 0;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: var(--page-bg);
      color: var(--text-main);
      font-size: 13px;
    }
    .sim-control-strip {
      background: #090d16;
      border-bottom: 2px solid #10b981;
      padding: 8px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      color: #f8fafc;
      font-size: 12px;
    }
    .sim-btn {
      padding: 5px 10px;
      border-radius: 5px;
      border: 1px solid #334155;
      background: #1e293b;
      color: #f8fafc;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    }
    .sim-btn.active {
      background: #10b981;
      color: #090d16;
      border-color: #10b981;
      font-weight: 700;
    }
    .vnu-header {
      background: var(--header-bg);
      border-bottom: 1px solid var(--border-col);
      padding: 6px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .vnu-portal-title {
      font-family: "Times New Roman", Times, serif;
      font-size: 24px;
      color: #35aa47;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .login-container {
      max-width: 1260px;
      margin: 18px auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
      min-height: 410px;
    }
    .yellow-reg-banner {
      background: var(--banner-yellow-bg);
      color: var(--banner-yellow-text);
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .yellow-reg-banner h4 {
      margin: 0 0 8px;
      font-size: 15px;
      font-family: "Times New Roman", Times, serif;
      text-transform: uppercase;
    }
    .yellow-reg-banner ul {
      margin: 0;
      padding-left: 20px;
      font-size: 12.5px;
      line-height: 1.7;
      font-weight: 600;
    }
    .section-heading {
      font-family: "Times New Roman", Times, serif;
      font-size: 16px;
      margin: 14px 0 8px;
      color: var(--text-main);
    }
    .info-list {
      list-style: square;
      padding-left: 22px;
      margin: 0 0 16px;
      line-height: 1.85;
    }
    .info-list a {
      color: var(--link-green);
      text-decoration: none;
      font-weight: 600;
    }
    .login-box {
      background: var(--card-bg);
      border: 1px solid #2b9348;
      align-self: start;
    }
    .login-box-header {
      background: var(--card-header-bg);
      color: #fff;
      padding: 10px 14px;
      font-size: 16px;
    }
    .login-box-body {
      padding: 16px 18px 20px;
    }
    .field-group {
      margin-bottom: 12px;
    }
    .field-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 600;
      font-size: 12.5px;
    }
    .field-group input {
      width: 100%;
      padding: 7px 10px;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      color: var(--text-main);
      font-size: 13px;
    }
    .cooldown-text {
      color: #ff4d4f;
      font-size: 12.5px;
      font-weight: 700;
      margin: 10px 0;
    }
    .login-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 10px 0 14px;
    }
    .btn-vnu-login {
      background: #2b9348;
      color: #fff;
      border: none;
      padding: 7px 14px;
      font-size: 13px;
      cursor: pointer;
    }
    .cf-box {
      background: #ffffff;
      color: #222;
      border: 1px solid #d1d5db;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 280px;
    }
    .cf-check {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      font-weight: 500;
    }
    .cf-check-icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #16a34a;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }
    .max-user-alert {
      background: var(--max-limit-bg);
      color: var(--max-limit-text);
      border: 1px solid var(--max-limit-border);
      padding: 14px 16px;
      font-size: 13px;
      line-height: 1.5;
      align-self: start;
    }
    .vnu-footer {
      border-top: 1px solid var(--border-col);
      margin-top: 40px;
      padding: 14px 24px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      color: var(--text-sub);
      font-size: 12px;
    }
    .vnu-footer-left {
      display: flex;
      gap: 24px;
    }
    .online-count {
      text-align: right;
    }
    .online-count strong {
      display: block;
      color: #ff3b30;
      font-size: 13.5px;
      margin-top: 2px;
    }
    .vnu-footer-links a {
      color: var(--text-sub);
      text-decoration: none;
      margin-left: 18px;
    }
  </style>
</head>
<body>
  <!-- Thanh chọn nhanh 3 trạng thái của trang /dang-nhap -->
  <div class="sim-control-strip">
    <div>
      <strong>🧪 MÔ PHỎNG TRANG <code>/dang-nhap</code> (Y HỆT ẢNH CHỤP):</strong>
      <button type="button" class="sim-btn __ACT_L_NORMAL__" data-lmode="normal">1. Đăng nhập bình thường (Ảnh 1 - Online: 14)</button>
      <button type="button" class="sim-btn __ACT_L_COOLDOWN__" data-lmode="cooldown">2. Bị văng & Phạt "Quay lại sau: 8phút" (Online: 33)</button>
      <button type="button" class="sim-btn __ACT_L_MAX__" data-lmode="max_users">3. Đạt giới hạn truy cập tối đa (Ảnh 2 - Online: 2386)</button>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <button type="button" class="sim-btn" id="toggle-theme-btn">🌗 Đổi Sáng (Gốc VNU) / Tối (Dark Reader)</button>
      <a href="/dang-ky-mon-hoc-nganh-1" class="sim-btn" style="background:#10b981;color:#090d16;border-color:#10b981;font-weight:700;">
        ➔ Vào trang /dang-ky-mon-hoc-nganh-1
      </a>
    </div>
  </div>

  <header class="vnu-header">
    __VNU_LOGO__
    <div class="vnu-portal-title">CỔNG THÔNG TIN ĐÀO TẠO ĐẠI HỌC</div>
  </header>

  <div class="login-container">
    <div>
      <div class="yellow-reg-banner">
        <h4>ĐANG ĐĂNG KÝ HỌC</h4>
        __REG_SCHOOLS_LIST__
      </div>

      <div class="section-heading">THÔNG BÁO</div>
      <ul class="info-list">
        <li><a href="javascript:void(0)">Hướng dẫn lấy lại mật khẩu Cổng thông tin đào tạo</a></li>
        <li><a href="javascript:void(0)">Hướng dẫn lấy lại mật khẩu email@vnu.edu.vn</a></li>
        <li><a href="javascript:void(0)">(Video) Hướng dẫn sử dụng Cổng thông tin đào tạo - Đăng ký học năm 2023</a></li>
        <li><a href="javascript:void(0)">Hướng dẫn cài app sinh viên - OneVNU</a></li>
      </ul>

      <div class="section-heading" style="font-size:15px;">Cổng thông tin dành cho sinh viên đã tốt nghiệp</div>
      <ul class="info-list">
        <li><a href="https://svtotnghiep.vnu.edu.vn" target="_blank">https://svtotnghiep.vnu.edu.vn</a></li>
      </ul>
    </div>

    <div>
      __RIGHT_LOGIN_COLUMN__
    </div>
  </div>

  <footer class="vnu-footer">
    <div class="vnu-footer-left">
      <div class="online-count">
        Đang online
        <strong>__ONLINE_USERS__</strong>
      </div>
      <div>
        <div>&copy; 2008-2026 Trung tâm Quản trị Đại học số - VNU</div>
        <div style="font-size:10px;opacity:0.8;margin-top:3px;">This page was rendered at 10/31/2026 1:32:49 AM by WEBDANGKYHOC</div>
      </div>
    </div>
    <div class="vnu-footer-links">
      <a href="javascript:void(0)">Trang chủ VNU</a>
      <a href="javascript:void(0)">Trang chủ DUAC</a>
    </div>
  </footer>

  <script>
    const savedTheme = localStorage.getItem('vnu_sim_theme') || 'dark';
    document.documentElement.setAttribute('data-vnu-theme', savedTheme);
    document.getElementById('toggle-theme-btn').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-vnu-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-vnu-theme', next);
      localStorage.setItem('vnu_sim_theme', next);
    });

    document.querySelectorAll('.sim-btn[data-lmode]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.location.href = '/dang-nhap?state=' + btn.dataset.lmode;
      });
    });

    const loginBtn = document.getElementById('vnu-login-submit');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        await fetch('/api/scenario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'normal' })
        });
        window.location.href = '/dang-ky-mon-hoc-nganh-1';
      });
    }
  </script>
</body>
</html>
"""


PORTAL_PAGE_HTML = """<!DOCTYPE html>
<html lang="vi" data-vnu-theme="dark">
<head>
  <meta charset="UTF-8">
  <title>Đăng ký học ngành 1 - Học kỳ 1 năm học 2026-2027</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --page-bg: #181a1b;
      --header-bg: #1b1d1e;
      --sidebar-bg: #1e2022;
      --sidebar-active: #26292b;
      --border-col: #34383a;
      --text-main: #e8e6e3;
      --text-sub: #9e9689;
      --table-th-bg: #202325;
      --row-open-bg: #454600;
      --row-full-bg: #181a1b;
      --cell-dk-full-bg: #3d4144;
      --reg-row-bg: #581515;
      --reg-row-text: #f5e6e6;
      --locked-bg: #3b1818;
      --locked-border: #6e2626;
      --locked-text: #e07a7a;
      --yellow-toast-bg: #5a480c;
      --yellow-toast-border: #786010;
      --yellow-toast-text: #f3d97d;
    }
    html[data-vnu-theme="light"] {
      --page-bg: #ffffff;
      --header-bg: #ffffff;
      --sidebar-bg: #f9f9f9;
      --sidebar-active: #eeeeee;
      --border-col: #dddddd;
      --text-main: #333333;
      --text-sub: #666666;
      --table-th-bg: #f5f5f5;
      --row-open-bg: #ffff99;
      --row-full-bg: #ffffff;
      --cell-dk-full-bg: #cccccc;
      --reg-row-bg: #f8d7da;
      --reg-row-text: #333333;
      --locked-bg: #f2dede;
      --locked-border: #ebccd1;
      --locked-text: #a94442;
      --yellow-toast-bg: #fcf8e3;
      --yellow-toast-border: #faebcc;
      --yellow-toast-text: #8a6d3b;
    }
    body {
      margin: 0;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: var(--page-bg);
      color: var(--text-main);
      font-size: 12.5px;
      padding-bottom: 90px;
    }

    /* Thanh điều khiển kịch bản giả lập ở trên cùng */
    .lab-bar {
      background: #090d16;
      border-bottom: 2px solid #10b981;
      padding: 8px 16px;
      color: #f8fafc;
    }
    .lab-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .scen-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .scen-btn {
      padding: 5px 10px;
      border-radius: 5px;
      border: 1px solid #334155;
      background: #1e293b;
      color: #f8fafc;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    }
    .scen-btn:hover { border-color: #06b6d4; }
    .scen-btn.active {
      background: #10b981;
      color: #090d16;
      border-color: #10b981;
      font-weight: 700;
    }
    .scen-btn.warning.active {
      background: #f59e0b;
      color: #090d16;
      border-color: #f59e0b;
    }
    .scen-btn.danger.active {
      background: #ef4444;
      color: #fff;
      border-color: #ef4444;
    }

    /* Header chuẩn VNU */
    .vnu-header {
      background: var(--header-bg);
      border-bottom: 1px solid var(--border-col);
      padding: 6px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .vnu-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .vnu-portal-title {
      font-family: "Times New Roman", Times, serif;
      font-size: 23px;
      color: #35aa47;
      text-transform: uppercase;
    }
    .vnu-user-btn {
      background: #2b9348;
      color: #ffffff;
      padding: 7px 12px;
      border-radius: 3px;
      font-size: 12.5px;
    }

    /* Khung chính: Sidebar trái + Nội dung phải */
    .vnu-body-wrap {
      display: grid;
      grid-template-columns: 235px 1fr;
      min-height: calc(100vh - 130px);
    }
    #main-nav {
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border-col);
    }
    .nav-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-col);
      color: var(--text-main);
      text-decoration: none;
      font-size: 13px;
    }
    .nav-link.green {
      color: #35aa47;
      font-weight: 600;
    }
    .nav-link.active-sub {
      background: var(--sidebar-active);
      padding-left: 24px;
      font-weight: 600;
    }

    .vnu-main-content {
      padding: 14px 20px 40px;
    }

    /* Trạng thái Đang khóa đăng ký học (Ảnh lúc 22:22) */
    .locked-view-title {
      font-size: 21px;
      font-weight: 400;
      margin: 4px 0 14px;
    }
    .locked-alert-box {
      background: var(--locked-bg);
      border: 1px solid var(--locked-border);
      color: var(--locked-text);
      padding: 14px 16px;
      border-radius: 3px;
      font-size: 13px;
    }

    /* Tiêu đề trang ĐKMH (Ảnh 3 & Ảnh 4) */
    .page-title-bar {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-col);
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .page-title-bar h2 {
      margin: 0;
      font-family: "Times New Roman", Times, serif;
      font-size: 22px;
      font-weight: 400;
    }
    .credit-limit-note {
      color: #ff3b30;
      font-size: 12.5px;
    }

    /* Box 1: Bảng xanh lá danh sách môn mở */
    .portlet-green {
      border: 1px solid #35aa47;
      margin-bottom: 10px;
    }
    .portlet-green-header {
      background: #35aa47;
      color: #ffffff;
      padding: 7px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 15px;
    }
    .sel-dsdk-mod {
      background: #1e2226;
      color: #fff;
      border: 1px solid #2e7d32;
      padding: 4px 8px;
      font-size: 12px;
    }
    html[data-vnu-theme="light"] .sel-dsdk-mod {
      background: #ffffff;
      color: #333333;
    }
    #divDSDK {
      max-height: 310px;
      overflow-y: auto;
    }
    table.vnu-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    table.vnu-table th,
    table.vnu-table td {
      border: 1px solid var(--border-col);
      padding: 5px 8px;
    }
    table.vnu-table th {
      background: var(--table-th-bg);
      font-weight: 700;
      text-align: center;
    }
    tr.vnu-row-open {
      background: var(--row-open-bg);
    }
    tr.vnu-row-full {
      background: var(--row-full-bg);
    }
    td.vnu-cell-dk-full {
      background: var(--cell-dk-full-bg);
      font-weight: 600;
    }

    /* Thanh nút ở giữa 2 bảng (Nút Ghi nhận hoặc "Ngoài thời hạn đăng ký!") */
    .middle-action-row {
      display: flex;
      justify-content: center;
      margin: 6px 0 10px;
    }
    .btn-out-of-time {
      background: #4e3805;
      color: #d9a441;
      border: 1px solid #6b4e09;
      padding: 6px 36px;
      font-size: 12.5px;
      border-radius: 3px;
    }
    html[data-vnu-theme="light"] .btn-out-of-time {
      background: #fcf8e3;
      color: #8a6d3b;
      border-color: #faebcc;
    }
    .confirm-registration {
      background: #35aa47;
      color: #ffffff;
      border: none;
      padding: 7px 22px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 3px;
      cursor: pointer;
    }

    /* Box 2: Bảng xanh dương Danh sách môn học đã đăng ký hoặc đã chọn */
    .portlet-blue {
      border: 1px solid #0099dd;
    }
    .portlet-blue-header {
      background: #0099dd;
      color: #ffffff;
      padding: 7px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 15px;
    }
    tr.vnu-reg-row {
      background: var(--reg-row-bg);
      color: var(--reg-row-text);
    }

    /* Thanh tổng kết tín chỉ dưới bảng 2 */
    .summary-bar {
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 12px 16px;
      border-top: 1px solid var(--border-col);
      border-bottom: 1px solid var(--border-col);
      margin-top: 10px;
      font-size: 12.5px;
    }
    .btn-print {
      background: #0099dd;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      border-radius: 3px;
      font-size: 12.5px;
      cursor: pointer;
    }

    /* Footer chuẩn VNU */
    .vnu-footer {
      padding: 14px 20px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      color: var(--text-sub);
      font-size: 12px;
    }
    .vnu-footer-left {
      display: flex;
      gap: 24px;
    }
    .online-count strong {
      display: block;
      color: #ff3b30;
      font-size: 13.5px;
      margin-top: 2px;
    }

    /* Các thanh thông báo vàng xếp chồng ở đáy màn hình giống hệt Ảnh 3 */
    #vnu-bottom-notifs {
      position: fixed;
      bottom: 0;
      left: 235px;
      right: 0;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 2px;
      pointer-events: none;
    }
    .vnu-yellow-notif {
      background: var(--yellow-toast-bg);
      border-top: 1px solid var(--yellow-toast-border);
      color: var(--yellow-toast-text);
      text-align: center;
      padding: 6px 12px;
      font-size: 12.5px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <!-- Thanh chọn kịch bản giả lập (Lab Bar) -->
  <section class="lab-bar">
    <div class="lab-row">
      <div>
        <strong style="color:#10b981;">🧪 GIẢ LẬP 1:1 CỔNG <code>dangkyhoc.vnu.edu.vn</code></strong>
        <span style="color:#94a3b8;font-size:12px;margin-left:8px;">
          Trạng thái: <strong id="current-mode-label" style="color:#f8fafc;">__MODE_LABEL__</strong>
          &bull; Request nhận: <strong id="req-counter" style="color:#06b6d4;">__REQ_COUNT__</strong>
        </span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button type="button" class="scen-btn" id="toggle-theme-btn">🌗 Giao diện: Sáng (Ảnh 3) / Tối (Ảnh 4)</button>
        <button type="button" class="scen-btn" id="reset-server-btn">↺ Reset Môn Học</button>
      </div>
    </div>
    <div class="scen-group">
      <button type="button" class="scen-btn __ACT_NORMAL__" data-mode="normal">
        🟢 1. Mở Cổng ĐKMH (Y hệt Ảnh 3 - Bảng Vàng/Hồng + Nút Ghi nhận)
      </button>
      <button type="button" class="scen-btn warning __ACT_OUT_TIME__" data-mode="out_of_time">
        🕒 2. "Ngoài thời hạn đăng ký!" (Y hệt Ảnh 4 - Ẩn ô tick, Online: 408)
      </button>
      <button type="button" class="scen-btn warning __ACT_LOCKED__" data-mode="portal_locked">
        🔒 3. "Đang khóa đăng ký học, bạn vui lòng thử lại sau!" (Mở sau 2 lần Chim Mồi)
      </button>
      <button type="button" class="scen-btn danger __ACT_503__" data-mode="overload_503">
        🔥 4. Nghẽn API 503 (Online: 2386 • Thông sau 2 lần Chim Mồi)
      </button>
      <button type="button" class="scen-btn danger" id="btn-white-503">
        💥 5. Sập Trắng Trang "The service is unavailable."
      </button>
      <button type="button" class="scen-btn danger __ACT_KICK__" data-mode="session_kicked">
        🚪 6. Văng Phiên Ngầm khi đang chạy Auto (Test Phanh Khẩn Cấp 0ms)
      </button>
      <a href="/dang-nhap?state=cooldown" class="scen-btn danger">
        ⏳ 7. Xem "/dang-nhap" (Quay lại sau: 8phút / Đạt giới hạn 2386 user)
      </a>
    </div>
  </section>

  <!-- Header chuẩn VNU -->
  <header class="vnu-header">
    <div class="vnu-header-left">
      __VNU_LOGO__
      <div class="vnu-portal-title">CỔNG THÔNG TIN ĐÀO TẠO ĐẠI HỌC</div>
    </div>
    <div class="vnu-user-btn">Chào mừng: Đặng Trần Minh Quốc - [25023522] &#9662;</div>
  </header>

  <div class="vnu-body-wrap">
    <!-- Sidebar chuẩn VNU (#main-nav) -->
    <aside id="main-nav">
      <a href="javascript:void(0)" class="nav-link"><span>🏠 Trang chủ</span></a>
      <a href="javascript:void(0)" class="nav-link green"><span>📗 Đăng ký môn học</span><span>&#8964;</span></a>
      <a href="/dang-ky-mon-hoc-nganh-1" class="nav-link active-sub"><span>&#9656; Đăng ký học ngành 1</span></a>
      <a href="javascript:void(0)" class="nav-link"><span>🖨️ In đăng ký học</span><span>&#8964;</span></a>
    </aside>

    <!-- Nội dung chính -->
    <main class="vnu-main-content">
      <!-- Khối 1: Khi cổng ở trạng thái "Đang khóa đăng ký học" -->
      <div id="vnu-locked-view" style="__LOCKED_VIEW_STYLE__">
        <div class="locked-view-title">Thông báo</div>
        <div class="locked-alert-box">
          Đang khóa đăng ký học, bạn vui lòng thử lại sau!
        </div>
      </div>

      <!-- Khối 2: Khi cổng hiển thị bảng môn học (Mở cổng hoặc Ngoài thời hạn đăng ký!) -->
      <div id="vnu-tables-view" style="__TABLES_VIEW_STYLE__">
        <div class="page-title-bar">
          <h2>📊 Đăng ký học ngành 1 - Học kỳ 1 năm học 2026-2027 - [2]</h2>
          <span class="credit-limit-note">Bạn được đăng ký trong khoảng tín chỉ: [11, 26]</span>
        </div>

        <!-- Bảng 1: Khung xanh lá Danh sách môn mở -->
        <div class="portlet-green">
          <div class="portlet-green-header">
            <span>Đăng ký học ngành 1 - Học kỳ 1 năm học 2026-2027 - [2]</span>
            <div>
              <select class="sel-dsdk-mod">
                <option value="1">Môn học theo ngành</option>
                <option value="2">Toàn trường</option>
              </select>
              <span style="margin-left:8px;">&#8963;</span>
            </div>
          </div>
          <div id="divDSDK">
            <table class="vnu-table">
              <thead>
                <tr>
                  <th style="width:140px;"></th>
                  <th>Môn học</th>
                  <th style="width:36px;">TC</th>
                  <th style="width:30px;"></th>
                  <th>Lớp MH</th>
                  <th style="width:44px;">Tổng</th>
                  <th style="width:44px;">ĐK</th>
                  <th>Giáo viên</th>
                  <th style="width:40px;"></th>
                  <th>Lịch học</th>
                </tr>
              </thead>
              <tbody>
                __INITIAL_DSDK_ROWS__
              </tbody>
            </table>
          </div>
        </div>

        <!-- Nút giữa 2 bảng: "Ngoài thời hạn đăng ký!" hoặc nút "Ghi nhận" -->
        <div class="middle-action-row col-md-offset-0">
          __MIDDLE_ACTION_HTML__
        </div>

        <!-- Bảng 2: Khung xanh dương Danh sách môn học đã đăng ký hoặc đã chọn -->
        <div class="portlet-blue">
          <div class="portlet-blue-header">
            <span>Danh sách môn học đã đăng ký hoặc đã chọn</span>
            <span>&#8963;</span>
          </div>
          <div id="divDSDKDaChon">
            <table class="vnu-table">
              <thead>
                <tr>
                  <th style="width:40px;">STT</th>
                  <th>Môn học</th>
                  <th style="width:38px;">TC</th>
                  <th>Lớp MH</th>
                  <th>Giáo viên</th>
                  <th>Lịch học</th>
                  <th style="width:150px;">Có lấy điểm cho ngành 1</th>
                  <th style="width:150px;">Có lấy điểm cho ngành 2</th>
                  <th style="width:120px;">Kiểu ĐK</th>
                  <th style="width:45px;">Hủy</th>
                </tr>
              </thead>
              <tbody id="registered-tbody">
                __REGISTERED_ROWS__
              </tbody>
            </table>
          </div>
        </div>

        <!-- Thanh tổng kết tín chỉ & môn học -->
        <div class="summary-bar">
          <div>Tổng số tín chỉ đã đăng ký: [<span id="sum-credits">__TOTAL_CREDITS__</span>]</div>
          <div>Tổng số môn học đã đăng ký: [<span id="sum-courses">__TOTAL_COURSES__</span>]</div>
          <button type="button" class="btn-print">🖨️ Xem và in</button>
        </div>
      </div>

      <!-- Footer chuẩn VNU -->
      <footer class="vnu-footer">
        <div class="vnu-footer-left">
          <div class="online-count">
            Đang online
            <strong id="online-number">__ONLINE_USERS__</strong>
          </div>
          <div>
            <div>&copy; 2008-2026 Trung tâm Quản trị Đại học số - VNU</div>
            <div style="font-size:10px;opacity:0.8;margin-top:3px;">This page was rendered at 10/31/2026 1:35:00 AM by WEBDANGKYHOC</div>
          </div>
        </div>
        <div>
          <a href="javascript:void(0)" style="color:inherit;text-decoration:none;margin-right:16px;">Trang chủ VNU</a>
          <a href="javascript:void(0)" style="color:inherit;text-decoration:none;">Trang chủ DUAC</a>
        </div>
      </footer>
    </main>
  </div>

  <!-- Khung thông báo vàng xếp chồng ở đáy trang (Y hệt Ảnh 3) -->
  <div id="vnu-bottom-notifs"></div>

  <script>
    const savedTheme = localStorage.getItem('vnu_sim_theme') || 'dark';
    document.documentElement.setAttribute('data-vnu-theme', savedTheme);
    document.getElementById('toggle-theme-btn').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-vnu-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-vnu-theme', next);
      localStorage.setItem('vnu_sim_theme', next);
    });

    window.$registrationMode = '1';
    window.$registrationAvailable = 'true';
    window.$dsdkMod = '1';
    window.App = { blockUI: function() {} };
    window.CheckConflict = function() {};

    function pushYellowBottomBanner() {
      const container = document.getElementById('vnu-bottom-notifs');
      if (!container) return;
      const bar = document.createElement('div');
      bar.className = 'vnu-yellow-notif';
      bar.textContent = 'Bạn đã thay đổi môn học. Các thay đổi này chỉ thực sự được ghi nhận sau khi bạn bấm nút Ghi nhận!';
      container.appendChild(bar);
      while (container.children.length > 2) {
        container.removeChild(container.firstChild);
      }
      setTimeout(() => {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }, 6500);
    }

    window.addEventListener('autodkmh:selected', () => {
      pushYellowBottomBanner();
      window.DSDK();
    });

    window.successCallback1 = function(htmlContent) {
      const tbody = document.querySelector('#divDSDK table tbody');
      if (tbody) tbody.innerHTML = htmlContent;
    };

    window.DSDK = async function() {
      const res = await fetch('/api/dsdk');
      const data = await res.json();
      if (typeof window.successCallback1 === 'function') {
        window.successCallback1(data.dsdk_html);
      }
      const regTbody = document.getElementById('registered-tbody');
      if (regTbody) regTbody.innerHTML = data.registered_html;
      const sumCredits = document.getElementById('sum-credits');
      if (sumCredits) sumCredits.textContent = data.total_credits;
      const sumCourses = document.getElementById('sum-courses');
      if (sumCourses) sumCourses.textContent = data.total_courses;
      await refreshStats();
    };

    window.jQuery = window.$ = function(selector) {
      const els = document.querySelectorAll(selector);
      return {
        length: els.length,
        html: function(content) {
          els.forEach(el => { el.innerHTML = content; });
        },
        append: function(child) {
          els.forEach(el => {
            if (typeof child === 'string') {
              el.insertAdjacentHTML('beforeend', child);
            } else if (child instanceof Node) {
              el.appendChild(child);
            }
          });
        },
        select2: function() { return '1'; }
      };
    };

    async function refreshStats() {
      try {
        const res = await fetch('/api/status');
        const st = await res.json();
        document.getElementById('req-counter').textContent = st.total_api_requests_received;
        document.getElementById('online-number').textContent = st.online_users;
        const labelMap = {
          normal: '🟢 Mở Cổng ĐKMH (Ảnh 3)',
          out_of_time: '🕒 Ngoài thời hạn đăng ký! (Ảnh 4)',
          portal_locked: '🔒 Đang khóa đăng ký học (Chờ Chim Mồi #' + st.probe_counter + '/2)',
          overload_503: '🔥 Quá tải 2,386 User - Nghẽn 503 (Chờ Chim Mồi #' + st.probe_counter + '/2)',
          session_kicked: '🚪 Đã bật Văng Phiên Ngầm (Test Phanh Khẩn Cấp)'
        };
        document.getElementById('current-mode-label').textContent = labelMap[st.mode] || st.mode;

        const lockedView = document.getElementById('vnu-locked-view');
        const tablesView = document.getElementById('vnu-tables-view');
        if (st.mode === 'portal_locked') {
          lockedView.style.display = 'block';
          tablesView.style.display = 'none';
        } else {
          lockedView.style.display = 'none';
          tablesView.style.display = 'block';
        }

        document.querySelectorAll('.scen-btn[data-mode]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === st.mode);
        });
      } catch (e) {}
    }

    setInterval(refreshStats, 1000);

    document.querySelectorAll('.scen-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch('/api/scenario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: btn.dataset.mode })
        });
        window.location.reload();
      });
    });

    document.getElementById('btn-white-503').addEventListener('click', async () => {
      await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'full_crash_503' })
      });
      window.location.reload();
    });

    document.getElementById('reset-server-btn').addEventListener('click', async () => {
      await fetch('/api/reset', { method: 'POST' });
      window.location.reload();
    });
  </script>
</body>
</html>
"""


class MockVNUHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def _send(self, code, body, content_type="text/html; charset=utf-8"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/dang-ky-mon-hoc-nganh-1")
            self.end_headers()
            return

        if path == "/dang-nhap":
            lstate = qs.get("state", [sim_state.get("login_submode", "cooldown")])[0]
            sim_state["login_submode"] = lstate

            if lstate == "max_users":
                online = 2386
                schools_html = """
                <ul>
                  <li>Trường Đại học Công nghệ - từ 2026-08-20 14:00:00 đến 2026-08-23 23:59:59</li>
                  <li>Trường Đại học Luật - từ 2026-08-17 14:00:00 đến 2026-08-28 14:00:00</li>
                  <li>Trường Đại học Việt Nhật - từ 2026-08-16 07:00:00 đến 2026-08-24 09:00:00</li>
                </ul>
                """
                right_col_html = """
                <div class="max-user-alert">
                  Hệ thống đã đạt đến giới hạn số người truy cập tối đa, vui lòng chờ đến khi tới lượt. Xin cảm ơn!
                </div>
                """
            else:
                online = 14 if lstate == "normal" else 33
                schools_html = ""
                cooldown_div = (
                    '<div class="cooldown-text">Quay lại sau: 8phút</div>'
                    if lstate == "cooldown"
                    else ""
                )
                user_val = "25023522" if lstate == "cooldown" else ""
                pass_val = "••••••••••" if lstate == "cooldown" else ""
                right_col_html = f"""
                <div class="login-box">
                  <div class="login-box-header">Đăng nhập hệ thống</div>
                  <div class="login-box-body">
                    <div class="field-group">
                      <label>Tên truy cập</label>
                      <input type="text" placeholder="Tên truy cập" value="{user_val}" />
                    </div>
                    <div class="field-group">
                      <label>Mật khẩu</label>
                      <input type="password" placeholder="Mật khẩu" value="{pass_val}" />
                    </div>
                    {cooldown_div}
                    <div class="login-actions">
                      <a href="javascript:void(0)" style="color:var(--link-green);text-decoration:none;font-size:12px;">Quên mật khẩu?</a>
                      <button type="button" class="btn-vnu-login" id="vnu-login-submit">&#10142;] Đăng nhập</button>
                    </div>
                    <div class="cf-box">
                      <div class="cf-check">
                        <span class="cf-check-icon">&#10003;</span>
                        <span>Thành công!</span>
                      </div>
                      <div style="text-align:right;font-size:9px;color:#555;">
                        <strong style="color:#f58220;font-size:10px;">CLOUDFLARE</strong><br>Quyền riêng tư &bull; Điều khoản
                      </div>
                    </div>
                  </div>
                </div>
                """

            html = (
                LOGIN_PAGE_HTML.replace("__VNU_LOGO__", VNU_LOGO_SVG)
                .replace("__REG_SCHOOLS_LIST__", schools_html)
                .replace("__RIGHT_LOGIN_COLUMN__", right_col_html)
                .replace("__ONLINE_USERS__", str(online))
                .replace("__ACT_L_NORMAL__", "active" if lstate == "normal" else "")
                .replace("__ACT_L_COOLDOWN__", "active" if lstate == "cooldown" else "")
                .replace("__ACT_L_MAX__", "active" if lstate == "max_users" else "")
            )
            self._send(200, html)
            return

        if path.startswith("/dang-ky-mon-hoc"):
            if sim_state["mode"] == "full_crash_503":
                sim_state["recovery_pings"] += 1
                if sim_state["recovery_pings"] >= 3:
                    set_scenario("normal")
                else:
                    self._send(
                        503,
                        "<!DOCTYPE html><html><head><title>Service Unavailable</title></head><body>The service is unavailable.</body></html>",
                    )
                    return

            mode = sim_state["mode"]
            reg_rows, total_credits, total_courses = render_registered_tbody_rows()
            middle_action_html = (
                '<div class="btn-out-of-time">Ngoài thời hạn đăng ký!</div>'
                if mode == "out_of_time"
                else '<button type="button" class="btn btn-success confirm-registration">💾 Ghi nhận</button>'
            )

            html = (
                PORTAL_PAGE_HTML.replace("__VNU_LOGO__", VNU_LOGO_SVG)
                .replace("__INITIAL_DSDK_ROWS__", render_dsdk_tbody_rows())
                .replace("__REGISTERED_ROWS__", reg_rows)
                .replace("__TOTAL_CREDITS__", str(total_credits))
                .replace("__TOTAL_COURSES__", str(total_courses))
                .replace("__MIDDLE_ACTION_HTML__", middle_action_html)
                .replace("__ONLINE_USERS__", str(sim_state["online_users"]))
                .replace("__REQ_COUNT__", str(sim_state["total_api_requests_received"]))
                .replace("__MODE_LABEL__", mode)
                .replace(
                    "__LOCKED_VIEW_STYLE__",
                    "display:block;" if mode == "portal_locked" else "display:none;",
                )
                .replace(
                    "__TABLES_VIEW_STYLE__",
                    "display:none;" if mode == "portal_locked" else "display:block;",
                )
                .replace("__ACT_NORMAL__", "active" if mode == "normal" else "")
                .replace("__ACT_OUT_TIME__", "active" if mode == "out_of_time" else "")
                .replace("__ACT_LOCKED__", "active" if mode == "portal_locked" else "")
                .replace("__ACT_503__", "active" if mode == "overload_503" else "")
                .replace("__ACT_KICK__", "active" if mode == "session_kicked" else "")
            )
            self._send(200, html)
            return

        if path == "/api/dsdk":
            reg_rows, total_credits, total_courses = render_registered_tbody_rows()
            self._send(
                200,
                json.dumps(
                    {
                        "dsdk_html": render_dsdk_tbody_rows(),
                        "registered_html": reg_rows,
                        "total_credits": total_credits,
                        "total_courses": total_courses,
                    }
                ),
                "application/json; charset=utf-8",
            )
            return

        if path == "/api/status":
            self._send(200, json.dumps(sim_state), "application/json; charset=utf-8")
            return

        self._send(404, "Not Found", "text/plain; charset=utf-8")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/reset":
            reset_state()
            self._send(200, json.dumps({"ok": True}), "application/json; charset=utf-8")
            return

        if path == "/api/scenario":
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length > 0 else {}
            set_scenario(body.get("mode", "normal"))
            self._send(200, json.dumps(sim_state), "application/json; charset=utf-8")
            return

        if path.startswith("/chon-mon-hoc/"):
            sim_state["total_api_requests_received"] += 1
            time.sleep(0.08)

            # Kịch bản 6: Đang chạy Auto thì bị văng phiên đăng nhập ngầm
            if sim_state["mode"] == "session_kicked":
                self.send_response(302)
                self.send_header("Location", "/dang-nhap?state=cooldown")
                self.end_headers()
                return

            # Kịch bản 2 & 3: Ngoài thời hạn đăng ký hoặc Đang khóa đăng ký học (Sau 2 lần Chim Mồi thăm dò sẽ tự mở cổng!)
            if sim_state["mode"] in ("portal_locked", "out_of_time"):
                sim_state["probe_counter"] += 1
                if sim_state["probe_counter"] <= 2:
                    msg = (
                        "Ngoài thời hạn đăng ký!"
                        if sim_state["mode"] == "out_of_time"
                        else "Đang khóa đăng ký học, bạn vui lòng thử lại sau!"
                    )
                    self._send(200, f"<div>{msg}</div>", "text/html; charset=utf-8")
                    return
                else:
                    set_scenario("normal")

            # Kịch bản 4: Quá tải 2,386 user -> API trả về 503 "The service is unavailable."
            if sim_state["mode"] == "overload_503":
                sim_state["probe_counter"] += 1
                if sim_state["probe_counter"] <= 2:
                    self._send(503, "The service is unavailable.", "text/html; charset=utf-8")
                    return
                else:
                    set_scenario("normal")

            if sim_state["mode"] == "full_crash_503":
                self._send(503, "The service is unavailable.", "text/html; charset=utf-8")
                return

            parts = path.strip("/").split("/")
            row_id = parts[1] if len(parts) > 1 else ""

            target = None
            for c in courses_state:
                if c["rowindex"] == row_id or c["class_code"].lower() == row_id.lower():
                    target = c
                    break

            if not target:
                self._send(
                    404,
                    json.dumps({"success": False, "message": f"Không tìm thấy mã môn {row_id}"}),
                    "application/json; charset=utf-8",
                )
                return

            target["attempts"] += 1
            # Các lớp Full (như UET.CS2046 7, UET.MAT1051 8, UET.MAT1051 9) sẽ nhả 1 slot ở gói tin thứ 8!
            if target["full_first_attempt"] and target["attempts"] < 8:
                self._send(
                    409,
                    json.dumps(
                        {
                            "success": False,
                            "message": f"Lớp {target['class_code']} hiện đã đầy ({target['enrolled']}/{target['max_slots']})!",
                        }
                    ),
                    "application/json; charset=utf-8",
                )
                return

            if target["full_first_attempt"] and target["enrolled"] >= target["max_slots"]:
                target["enrolled"] = target["max_slots"]

            target["status"] = "pending"
            self._send(
                200,
                json.dumps({"success": True, "message": f"Đã chọn {target['class_code']}"}),
                "application/json; charset=utf-8",
            )
            return

        if path.startswith("/xac-nhan-dang-ky/"):
            sim_state["total_api_requests_received"] += 1
            time.sleep(0.06)

            if sim_state["mode"] == "session_kicked":
                self.send_response(302)
                self.send_header("Location", "/dang-nhap?state=cooldown")
                self.end_headers()
                return

            if sim_state["mode"] in ("overload_503", "full_crash_503"):
                self._send(503, "The service is unavailable.", "text/html; charset=utf-8")
                return

            confirmed_list = []
            for c in courses_state:
                if c["status"] == "pending":
                    c["status"] = "confirmed"
                    confirmed_list.append(c["class_code"])
                elif c["status"] == "confirmed":
                    confirmed_list.append(c["class_code"])

            msg = (
                f"Đã ghi nhận thành công: {', '.join(confirmed_list)}!"
                if confirmed_list
                else "Chưa có học phần mới nào được chọn."
            )
            self._send(
                200,
                json.dumps({"success": True, "message": msg}),
                "application/json; charset=utf-8",
            )
            return

        self._send(404, json.dumps({"error": "Not found"}), "application/json; charset=utf-8")


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), MockVNUHandler)
    print(f"VNU 1:1 Simulator listening on http://localhost:{PORT}")
    server.serve_forever()
