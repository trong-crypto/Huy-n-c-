# Trợ lý AI Huyền Cơ

Trang `/tu-van` có hai lối vào. **Chat với tư vấn viên** dùng luồng REST/STOMP và cơ chế lưu tin hiện có. **Hỏi AI** mở `/tu-van/hoi-ai` và giữ các lượt trao đổi trong bộ nhớ của trang. Tải lại hoặc rời trang sẽ kết thúc phiên hỏi AI.

## Chạy trên localhost

- Backend dùng Maven profile `database`, Spring profile `db` và `AUTH_ENABLED=true`. Dùng cấu hình datasource TEST, CSRF và Origin đã được nghiệm thu cho Auth.
- Client dùng `NEXT_PUBLIC_ACCOUNT_HISTORY=1`, `NEXT_PUBLIC_API_BASE_URL=/api/v1` và `HUYENCO_API_URL` trỏ tới Backend. Cùng proxy với Auth cho phép trình duyệt dùng cookie và CSRF của tài khoản.
- Mặc định `AI_PROVIDER=demo`. Chế độ này trả nội dung minh họa bằng tiếng Việt tại Backend. Người dùng thấy nhãn **DEMO** và có thể thử cả hỏi thông thường lẫn hỏi kèm quẻ.
- Để demo AI thật, ưu tiên Ollama với một model `qwen2.5:1.5b`. Đặt `OLLAMA_HOST=127.0.0.1:11434` và `OLLAMA_NO_CLOUD=1` trong tiến trình Ollama. Dùng [tài liệu Windows](https://docs.ollama.com/windows) và [API tương thích](https://docs.ollama.com/api/openai-compatibility).
- Đặt các biến sau trong **tiến trình Backend** rồi khởi động lại Backend TEST. URL bên ngoài, nếu có trong cấu hình cũ, dùng HTTPS và khóa từ nguồn bí mật. Cấu hình demo nội bộ dùng địa chỉ loopback.

| Biến Backend | Giá trị |
| --- | --- |
| `AI_PROVIDER` | `openai-compatible` |
| `AI_API_URL` | `http://127.0.0.1:11434/v1/chat/completions` cho Ollama |
| `AI_API_MODEL` | `qwen2.5:1.5b` |
| `AI_API_KEY` | `ollama` là placeholder local. Khóa thật, nếu dùng, chỉ đặt ở Backend. |
| `AI_API_TOKEN_FIELD` | `max_tokens` cho Ollama. Mặc định `max_completion_tokens`. |
| `AI_API_MAX_TOKENS` | Thử `180` cho demo local. Hợp lệ từ 1 đến 1.000. |
| `AI_API_TIMEOUT_SECONDS` | Tối đa 60 giây. Mặc định 12 giây. |

`AI_PROVIDER=off` tắt trả lời. Chế độ tương thích thiếu URL, model hoặc khóa báo `off`. Chế độ `live` báo cấu hình đã đủ để thử gửi. Thông tin này chưa xác nhận provider đã trả lời thành công.

Trước buổi demo, gửi một câu thử local để nạp model. Giữ thời gian chờ Client 65 giây để Backend có thể trả lỗi `AI_TIMEOUT` trước. Chất lượng tiếng Việt và độ bám dữ kiện cần kiểm với tình huống demo thực tế.

## Hợp đồng REST

Cả hai endpoint dùng envelope `requestId`, `status`, `data`, `error` và trả `Cache-Control: no-store`.

- `GET /api/v1/ai/status` trả `data.mode` bằng `demo`, `live` hoặc `off`.
- `POST /api/v1/ai/ask` cần cookie phiên tài khoản USER/CONSULTANT, Origin hợp lệ nếu có, `X-HuyenCo-Request: 1` và `X-CSRF-Token` của phiên. Dùng `Content-Type: application/json`.
- `question` có từ 1 đến 1.000 ký tự sau khi bỏ khoảng trắng đầu/cuối. Có thể gửi tối đa ba `turns`, mỗi lượt gồm `question` cùng giới hạn và `answer` tối đa 1.200 ký tự.
- `readingId` và `calculationRequestId` là UUID tùy chọn và loại trừ lẫn nhau. Nếu có `readingId`, Backend chỉ tra bản đã lưu theo chủ sở hữu. Nếu có `calculationRequestId`, Backend ưu tiên bản đã lưu của chủ sở hữu rồi tra bộ nhớ đệm của đúng tài khoản và phiên tính. Kết quả chưa lưu phụ thuộc thời hạn của bộ nhớ đệm hiện có, mặc định tối đa 15 phút.
- Thành công trả `data.answer`, `data.mode`, `data.sources` và `data.reading`. Với hỏi thông thường, `sources` là mảng rỗng và `reading` là `null`. Với kết quả Mai Hoa, trường `reading` chứa phương pháp, ba quẻ, hào động, trạng thái nguồn và căn cứ áp dụng từ Server.
- Khi thư viện đã bật, Backend lấy trích đoạn từ bản PUBLISHED có snapshot nguồn VERIFIED của từng mã quẻ. Chỉ quẻ chủ có trích đoạn đúng vị trí hào động. Nếu thiếu bản công bố, Backend báo rõ trong phản hồi LIVE.
- Backend gửi kết quả Mai Hoa, tên nguồn và trích đoạn đã công bố thành các mục riêng trong ngữ cảnh của mô hình. Phản hồi lấy tên sách và danh mục nguồn từ Server. Nếu mô hình tự lập danh mục nguồn, Backend bỏ phần đó. Nguồn thư viện trong `sources` có thể kèm `url`. Các nguồn tính quẻ giữ thông tin trang in và PDF.

```json
{
  "question": "Hào động có vai trò gì trong kết quả này?",
  "calculationRequestId": "550e8400-e29b-41d4-a716-446655440003",
  "turns": []
}
```

| HTTP | Mã lỗi | Trường hợp |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | Câu hỏi, lượt trao đổi hoặc tham chiếu sai hợp đồng |
| 401 | `LOGIN_REQUIRED`, `INVALID_SESSION` | Thiếu phiên tài khoản hợp lệ |
| 403 | `CSRF_REJECTED`, `FORBIDDEN` | Yêu cầu không đạt kiểm tra quyền hoặc CSRF |
| 404 | `NOT_FOUND` | Thiếu quẻ Mai Hoa khả dụng trong phạm vi của người hỏi |
| 429 | `TOO_MANY_REQUESTS` | Backend đang xử lý đủ số yêu cầu AI đồng thời |
| 503 | `AI_UNAVAILABLE`, `DATABASE_UNAVAILABLE` | Dịch vụ AI hoặc kho dữ liệu chưa khả dụng |
| 504 | `AI_TIMEOUT` | Provider quá thời gian chờ |

## Dữ liệu gửi và lưu trữ

Khi dùng provider ngoài, giao diện báo trước khi người dùng gửi. Backend chỉ chuyển câu hỏi, tối đa ba lượt trao đổi gần nhất, cùng các dữ kiện Mai Hoa được chọn từ bản gốc. Dữ kiện gồm tên đã xác minh hoặc mã quẻ, hào động, chủ đề, đoạn luận, trạng thái nguồn, quy ước nhóm và một số vị trí tham chiếu. Trình duyệt chỉ gửi mã tra cứu, quyền đọc được kiểm tra lại trên Server.

Cookie, CSRF, ID tài khoản, mã lịch sử, ngày giờ đầu vào và toàn bộ lịch sử không nằm trong nội dung gửi provider. Câu hỏi do người dùng gõ có thể chứa thông tin cá nhân, vì vậy giao diện nhắc người dùng tránh nhập thông tin đó. Các nguồn hiển thị bên dưới phản hồi do Backend trích từ kết quả đã xác minh quyền. Phần giải thích của provider là văn bản do mô hình sinh và vẫn có thể sai.

Backend AI dùng phiên tài khoản hiện có và đọc kết quả Mai Hoa cùng các bản thư viện đã công bố. AI và Chat tư vấn viên có API, trạng thái và lịch sử độc lập.
