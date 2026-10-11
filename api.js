// api.js
// Wishlist Manager - Node.js
// Yêu cầu: Node.js 18 trở lên

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const API_BASE = "https://danger-wishlist-manager.vercel.app";

function validateCredentials(uid, password) {
    if (!/^\d{1,20}$/.test(String(uid || ""))) {
        throw new Error("UID không hợp lệ.");
    }

    if (
        typeof password !== "string" ||
        password.length < 1 ||
        password.length > 512
    ) {
        throw new Error("Password không hợp lệ.");
    }
}

function validateItemIds(itemIds) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        throw new Error("Vui lòng nhập ít nhất một ID vật phẩm.");
    }

    if (itemIds.length > 100) {
        throw new Error("Mỗi lần chỉ được xử lý tối đa 100 ID.");
    }

    const ids = itemIds.map(id => String(id).trim());

    for (const id of ids) {
        if (!/^\d{1,30}$/.test(id)) {
            throw new Error(`ID vật phẩm không hợp lệ: ${id}`);
        }
    }

    return [...new Set(ids)];
}

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        service: "Wishlist Manager API",
        message: "Máy chủ đang hoạt động."
    });
});

// Kiểm tra tệp JSON và trích xuất thông tin tài khoản.
// Tệp được gửi trong bộ nhớ, không lưu xuống ổ đĩa.
app.post("/api/parse-account", (req, res) => {
    try {
        const data = req.body;

        const info = data?.guest_account_info;

        const uid = info?.["com.garena.msdk.guest_uid"];
        const password = info?.["com.garena.msdk.guest_password"];

        validateCredentials(uid, password);

        res.json({
            ok: true,
            account: {
                uid: String(uid),
                password: String(password)
            }
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            error: error.message || "Không đọc được dữ liệu tài khoản."
        });
    }
});

// Thao tác Wishlist.
// Giữ đúng đường dẫn theo mô tả của người dùng:
// Thêm -> remove-wish
// Xóa -> add-wish
//
// Lưu ý: hai đường dẫn này có tên ngược với chức năng mô tả.
// Hãy xác minh API trước khi sử dụng trên tài khoản thật.
app.post("/api/wishlist", async (req, res) => {
    try {
        const { uid, password, itemIds, action } = req.body;

        validateCredentials(uid, password);

        const ids = validateItemIds(itemIds);

        if (!["add", "remove"].includes(action)) {
            return res.status(400).json({
                ok: false,
                error: "Action phải là add hoặc remove."
            });
        }

        const endpoint =
            action === "add"
                ? "remove-wish"
                : "add-wish";

        const url = new URL(`${API_BASE}/${endpoint}`);

        url.searchParams.set("uid", String(uid));
        url.searchParams.set("password", password);
        url.searchParams.set("item_ids", ids.join(","));

        const upstream = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            signal: AbortSignal.timeout(15000)
        });

        const text = await upstream.text();

        let data;

        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text.slice(0, 2000) };
        }

        res.status(upstream.ok ? 200 : 502).json({
            ok: upstream.ok,
            action,
            status: upstream.status,
            result: data
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            error: error.message || "Không thể thực hiện yêu cầu."
        });
    }
});

// Không tạo endpoint giả để đọc Wishlist trong game.
// Cần tích hợp API đọc danh sách thực tế khi có đường dẫn và
// cấu trúc JSON phản hồi chính xác.

app.listen(PORT, "127.0.0.1", () => {
    console.log(`Wishlist Manager: http://127.0.0.1:${PORT}`);
});
