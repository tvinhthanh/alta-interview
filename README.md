# Bảng xếp hạng tháng

Bài làm cho phần Monthly Leaderboard trong đề của Alta Software. Màn hình gồm tab chọn tháng, top 3 nổi bật, mỗi trang 10 người chia 2 cột, ô "Hạng của tôi" ở dưới và dữ liệu cập nhật realtime.

Dự án dùng Next.js 15 (App Router), React 19, TypeScript và CSS Modules. Màu, cỡ chữ, khoảng cách đều để trong biến CSS ở `src/app/globals.css`. Mình không dùng UI library hay Tailwind, icon lấy từ `lucide-react`. Đề không yêu cầu backend nên API, "database" và socket đều là mock, chạy luôn trong trình duyệt.

## Cài đặt và chạy

Cần Node 22 trở lên. Test chạy thẳng file `.ts` bằng `--experimental-strip-types`, Node cũ hơn không có cờ này.

```bash
npm install
npm run dev
```

Mở http://localhost:3000. Các lệnh khác:

```bash
npm test            # unit test phần tính hạng
npm run typecheck
npm run build && npm start
```

### Vì sao có `npm test`

Phần dễ sai nhất của bài này không nằm ở giao diện mà ở cách tính hạng: bằng điểm thì đánh số thế nào, nhóm đồng hạng vắt qua hai trang có bị lặp hay sót người không, khi nào một thay đổi realtime thật sự ảnh hưởng tới trang đang xem. Mấy lỗi kiểu này bấm tay trên giao diện rất khó bắt, vì phải dựng đúng dữ liệu mới thấy. Nên mình tách toàn bộ logic đó ra `src/domain/ranking.ts` và viết test riêng cho nó trong `ranking.test.ts`.

Test cover các trường hợp:

- Xếp theo điểm, không theo thứ tự dữ liệu đổ về.
- Bằng điểm thì cùng hạng, người kế tiếp lấy hạng liền sau (1, 2, 2, 3).
- Nhóm đồng hạng nằm vắt qua ranh giới trang thì không lặp, không sót.
- Trang vượt quá số trang thì được kéo về trang cuối.
- Thanh phân trang luôn đủ 7 ô.
- So sánh hai lần xem để biết ai lên, ai xuống, ai mới vào trang, kể cả người từ trang khác nhảy lên.
- Một thay đổi có chạm tới trang đang xem hay không. Đây chính là điều kiện để quyết định có cần gọi API.

Mình dùng test runner có sẵn của Node (`node --test`) chứ không cài Jest hay Vitest. Phần cần test là TypeScript thuần, không đụng React hay trình duyệt, nên không cần thêm thư viện hay cấu hình gì. Cả bộ chạy chưa tới một giây. Nếu sau này đổi quy tắc xếp hạng (ví dụ chuyển sang hạng không trùng để trao quà như ở mục 02), chỉ cần sửa `rankPlayers` rồi chạy `npm test` là biết ngay chỗ nào bị ảnh hưởng.

Phần hook và giao diện hiện chưa có test tự động. Mình kiểm tra phần đó trên trình duyệt (xem mục 03), và có ghi trong mục 05 là việc cần làm tiếp.

### Bảng mô phỏng

Cuối trang có một khung "Bảng mô phỏng dữ liệu & mạng" để thử các tình huống mà không phải sửa code. Ở đó có thể đổi chất lượng mạng của mock API (Ổn định, Chập chờn, Rất tệ), bật/tắt biến động tự động, ngắt và nối lại socket, thêm người chơi, cộng điểm cho mình, hoặc tạo đồng hạng ngay ở cuối trang 1.

Muốn chỉnh sâu hơn thì sửa trong code:

| Muốn chỉnh | Ở đâu |
| --- | --- |
| Độ trễ, tỉ lệ lỗi, tỉ lệ treo của từng mức mạng | `NETWORK_PROFILES` trong `src/data/network.ts` |
| Mức mạng mặc định | `let profile = NETWORK_PROFILES[0]` cùng file |
| Timeout của một request (6 giây) | `REQUEST_TIMEOUT_MS` cùng file |
| Nhịp biến động tự động (2,8 giây) | `INTERVAL_MS` trong `src/data/simulator.ts` |
| Mức cộng/trừ điểm, tỉ lệ người mới | `DELTAS` và hàm `tick()` cùng file |
| Độ trễ socket (kết nối 400–900ms, sự kiện 30–150ms) | `connect()` trong `src/realtime/mockSocket.ts` |
| Khoảng gom cập nhật realtime (1 giây) | `LIVE_INTERVAL_MS` trong `src/hooks/useLeaderboard.ts` |
| Số snapshot giữ lại (60) | `SNAPSHOT_LIMIT` trong `src/data/mockDb.ts` |
| Số người mỗi trang | `PAGE_SIZE` trong `src/config.ts` |
| Dữ liệu mẫu | `SEEDS` trong `src/data/mockDb.ts` |

Dữ liệu mẫu được dựng sẵn để mỗi tháng thử một kiểu:

- Tháng 8: 112 người, có một cái tên rất dài để xem cách hiển thị tên.
- Tháng 9: 104 người, 3 người đồng hạng #5 vắt qua trang 1 và trang 2, mình nằm ở trang 10.
- Tháng 10: 118 người, mình không tham gia.
- Tháng 11: 103 người, tháng đang diễn ra, có realtime, 3 người đồng hạng #2.
- Tháng 12: chưa bắt đầu, bảng trống.

### Code để ở đâu

```
src/
  domain/      tính hạng, đồng hạng, phân trang, so sánh thay đổi (TypeScript thuần, có test)
  data/        mock DB, mock API, giả lập mạng, bộ sinh biến động
  realtime/    socket giả lập, API na ná socket.io-client
  hooks/       useLeaderboard: toàn bộ logic tải trang, realtime, chống dữ liệu cũ
  ui/          component hiển thị
  lib/         LatestOnly: huỷ request cũ, chỉ nhận kết quả mới nhất
```

`domain` không import React hay mock nên test bằng `node --test` là đủ. Khi có backend thật, chỉ cần viết lại `src/data/leaderboardApi.ts` bằng `fetch`, UI không phải đổi gì.

---

## 01. Những vấn đề thấy được từ đề và thiết kế

Đọc đề xong, mình thấy có vài chỗ chưa rõ hoặc dễ làm sai.

Về dữ liệu, thiết kế đặt "#100 John Wick" ở ô hạng của tôi, trong khi mỗi trang chỉ có 10 người. Nghĩa là hạng cá nhân phải lấy riêng, không suy ra từ trang đang xem được. Chỗ khó hơn là dữ liệu đổi ngay trong lúc người dùng đang lật trang. Nếu trang nào cũng đọc bản mới nhất thì người cuối trang 1 có thể bị đẩy xuống rồi hiện lại ở đầu trang 2, hoặc ngược lại có người biến mất. Tổng số người cũng thay đổi khi có người mới vào, nên số trang thay đổi theo. Ngoài ra socket và HTTP là hai đường riêng, sự kiện có thể đến trước hoặc sau response, có khi còn lệch thứ tự nhau.

Về nghiệp vụ, đề nói "xếp theo điểm" nhưng không nói hai người bằng điểm thì ai đứng trên, và người ngay sau nhóm đồng hạng mang hạng mấy. Nhìn kỹ thiết kế thì có hai người cùng #5, người kế tiếp là #6, tức là bằng điểm thì giữ chung hạng và hạng sau không nhảy cóc (1, 2, 2, 3 chứ không phải 1, 2, 2, 4 như kiểu xếp hạng thi đấu). Đây là chỗ dễ làm sai nếu chỉ đọc chữ, vì "xử lý bằng điểm" có thể hiểu theo nhiều cách, nên mình làm theo đúng thiết kế. Nếu nghiệp vụ cần hạng không trùng (như trao quà theo mốc ở mục 02) thì đổi được ở một dòng, phần hiển thị giữ nguyên. "Nổi bật top 3" cũng có hai cách hiểu: 3 dòng đầu, hay tất cả những ai có hạng từ 3 trở lên. Khi có đồng hạng thì hai cách này cho kết quả khác nhau. Thiết kế cũng không có màn hình cho các trường hợp: mình không tham gia tháng đó, tháng chưa có ai, tháng chưa bắt đầu.

Về trải nghiệm, nếu realtime cứ sắp xếp lại bảng liên tục thì dòng đang đọc sẽ chạy mất, nút định bấm cũng bị dời chỗ. Bấm chuyển trang hay đổi tháng nhanh thì response về muộn của lần bấm trước có thể đè lên lần sau. Thiết kế không vẽ loading, empty, error, và bố cục mobile để ứng viên tự đề xuất.

## 02. Giả định và quy tắc mình dùng

- Bằng điểm thì cùng hạng, người kế tiếp lấy hạng liền sau, không nhảy cóc (1, 2, 2, 3), theo đúng thiết kế (hai người #5 rồi tới #6).
- Trong nhóm bằng điểm, ai đạt mức điểm đó trước thì đứng trên, cuối cùng mới xét theo `id`. Nhờ vậy thứ tự luôn cố định, cắt trang ở đâu cũng ra cùng một kết quả.
- Nếu sau này nghiệp vụ đổi, ví dụ phải có đúng một top 1, một top 2 để trao quà theo từng mốc và không được trùng hạng, thì người bằng điểm sẽ phân thứ tự theo thời điểm đạt mức điểm đó: ai đạt trước xếp trên. Danh sách vốn đã được sắp theo đúng thứ tự này (điểm giảm dần, rồi thời điểm đạt điểm, rồi `id`), nên chỉ cần đổi cách đánh số trong `rankPlayers` (`src/domain/ranking.ts`) từ "bằng điểm thì giữ hạng người trước" sang "hạng = vị trí" (`rank = position`). Thứ tự hiển thị, phân trang và realtime không phải sửa gì.
- Hạng được tính trên cả danh sách rồi mới chia trang. Nhóm đồng hạng vắt qua hai trang thì trang 2 mở đầu bằng đúng hạng của dòng cuối trang 1.
- Top 3 nổi bật theo hạng, không theo vị trí: cả dòng tô màu vàng, bạc, đồng, có vương miện cùng màu nằm giữa tên và điểm, số hạng 1, 2, 3 viết to và không có dấu `#`. Ba người cùng hạng 2 thì cả ba cùng màu bạc. Mình thấy không hợp lý khi hai người bằng điểm mà một người được làm nổi bật, người kia không.
- Đồng hạng chỉ thể hiện bằng việc cùng số hạng, không thêm ký hiệu nào khác. Trình đọc màn hình vẫn đọc thêm "đồng hạng".
- Tên dài không vừa chỗ thì bỏ tên đệm, giữ họ và tên ("Tôn Nữ Hoàng Thị Phương Thảo Nguyên" thành "Tôn Nguyên"). Cắt bằng "…" thì mất đúng phần tên chính. Rê chuột vẫn xem được tên đầy đủ.
- Dòng của chính mình có viền vàng quanh avatar và nhãn "bạn" nhỏ ở góc.
- Mỗi tháng có một trong ba trạng thái: đã chốt, đang diễn ra, chưa bắt đầu. Chỉ tháng đang diễn ra mới có realtime. Mở trang lên thì mặc định vào tháng đang diễn ra.
- Người dùng giả lập là Trương Vĩnh Thành. Tháng nào không có điểm thì ô hạng ghi rõ là chưa xếp hạng, không hiện số.
- Avatar lấy từ `i.pravatar.cc` theo `id`. Ảnh lỗi thì hiện chữ cái đầu.

## 03. Giữ dữ liệu nhất quán khi phân trang và có realtime

Ý chính: mỗi lần mockDb thay đổi thì tăng `revision` của tháng đó và lưu lại một bản đã xếp hạng (snapshot). Mọi response đều trả kèm `revision`.

Khi phân trang, lần tải đầu client xin bản mới nhất và nhớ revision nhận được. Từ đó mọi lần chuyển trang đều xin đúng revision đó, nên trang 1 đến trang N đều cắt từ cùng một danh sách và không có ai lặp hay bị sót. Ô "Hạng của tôi" cũng đọc cùng revision, nên hạng ở ô đó luôn khớp với hạng trong danh sách. Nút "Xem trang X" tính trang từ vị trí thật trong danh sách chứ không từ số hạng, nên lúc có đồng hạng vẫn nhảy đúng trang.

Với realtime, client so `revision` của sự kiện với bản đang hiển thị. Cũ hơn hoặc bằng thì bỏ qua, nhờ vậy sự kiện đến muộn hay lệch thứ tự cũng không sao. Mới hơn thì tuỳ trường hợp:

- Mỗi sự kiện có kèm vị trí cũ, vị trí mới và tổng số người. Vì hạng đánh số liên tục, một thay đổi ở vị trí p (kể cả chỉ làm hai người thành bằng điểm mà không đổi chỗ) có thể làm lệch hạng của mọi người từ p trở xuống, nhưng không ảnh hưởng những người phía trên. Nên một người đi từ vị trí 40 lên 20 không chạm gì tới top 10: client không gọi API, chỉ cập nhật con số "người tham gia". Mình tính thêm cả dòng ngay trên p, vì trạng thái đồng hạng của dòng đó cũng có thể đổi. Cách này chỉ dùng khi revision liền nhau, lỡ mất sự kiện nào thì quay về tải lại cho chắc.
- Nếu trang đang xem có bị ảnh hưởng thì tải lại trang hiện tại, kèm luôn hạng của mình trong cùng một request, rồi thay cả hai một lúc. Lần thay đầu áp dụng ngay, các lần sau gom tối đa mỗi giây một lần. Đang có một lượt tải chạy thì không gọi chồng lên, đợi nó về rồi mới tính tiếp.
- Tải về mà trang giống hệt bản cũ thì giữ nguyên, không render lại.
- Các dòng đổi chỗ thì trượt tới vị trí mới. Ai đổi hạng cũng có ↑/↓ nhỏ, mờ dần sau 4 giây. Riêng người tự đổi điểm thì điểm chạy số và nền nháy xanh hoặc đỏ, để nhìn là biết ai gây ra thay đổi. Hạng cũ lấy từ server (request gửi kèm `since`), nên người từ trang khác nhảy lên cũng có mũi tên, ví dụ ↑17.
- Khi chuột đang nằm trên bảng hoặc đang focus bằng bàn phím trong bảng, bảng giữ nguyên và dòng trạng thái báo là có điểm mới. Rời chuột ra thì mới cập nhật.
- Cập nhật ngầm bị lỗi mạng thì giữ bảng cũ và thử lại ở lần sau, không hiện màn hình lỗi.
- Mất kết nối rồi nối lại, socket gửi revision mới nhất của từng tháng để client biết mình đã lỡ những gì.
- Snapshot chỉ giữ 60 bản gần nhất. Nếu người dùng ngồi lâu quá, bản đang xem bị dọn mất, thì lần chuyển trang kế tiếp sẽ tự tải bản mới và báo một dòng.

Để không dính dữ liệu cũ khi bấm nhanh, mỗi request mới huỷ request trước (`AbortController`) và kiểm tra lại trước khi ghi state. Bấm "Trang sau" 4 lần liền thì chỉ trang cuối cùng được hiện. Đổi tháng thì cả khung bảng mount lại từ đầu (`key={monthId}`), không còn state nào của tháng trước. Cache theo (tháng, revision, trang); cùng revision thì dữ liệu không đổi, nên cache không bao giờ cũ và không cần xoá.

Còn chuyện giật bố cục: lúc tải, danh sách hiện skeleton đúng kích thước dòng thật, và luôn giữ chỗ cho đủ 10 dòng kể cả trang cuối ít người hay lúc lỗi. Thanh phân trang luôn có đúng 7 ô nên hai nút mũi tên không xê dịch. Mình đã đo trên trình duyệt: tiêu đề, tab, khung bảng, phân trang và ô hạng của tôi giữ nguyên toạ độ qua mọi lần chuyển trang và đổi tháng.

Phần này đã thử trên trình duyệt: lật hết 11 trang của tháng đang diễn ra trong lúc realtime vẫn chạy thì thấy đủ 104/104 người, không ai lặp. Ở tháng 9, nhóm 3 người cùng #5 nằm đúng ở cuối trang 1 và đầu trang 2.

## 04. Các quyết định kỹ thuật

Mình dùng snapshot theo revision vì với phân trang kiểu offset, đây là cách đơn giản nhất mình nghĩ ra để không lặp, không sót người khi dữ liệu đang đổi. Đổi lại, server phải giữ vài bản cũ trong bộ nhớ.

Realtime tự cập nhật chứ không bắt người dùng bấm nút. Bản đầu mình làm banner "Có N thay đổi, bấm để cập nhật", nhưng con số cứ dồn lên mà bảng thì đứng im, dùng thấy khó chịu. Bây giờ bảng tự cập nhật, chỉ những dòng bị ảnh hưởng mới đổi, và bảng tạm dừng khi người dùng đang thao tác. Cái giá là số liệu có thể trễ khoảng một giây.

Phần tính hạng được tách ra `domain` vì logic hạng, đồng hạng, chia trang là chỗ dễ sai nhất. Để nó là TypeScript thuần thì test riêng được, nhanh, không cần trình duyệt.

Socket giả lập viết theo kiểu socket.io và có độ trễ ngẫu nhiên. Thay bằng socket thật thì hook không phải đổi, còn độ trễ ngẫu nhiên buộc client phải xử lý đúng chuyện sự kiện đến lệch thứ tự ngay từ bây giờ.

Style dùng CSS Modules và biến CSS. Muốn đổi theme chỉ cần sửa một file, đổi lại phải tự viết các trạng thái hover, focus, disabled. Icon lấy từ `lucide-react` cho đồng bộ, không tự vẽ.

Animation thì tự viết, không dùng Framer Motion. Chỉ cần trượt dòng (FLIP), nháy nền và chạy số, tự viết chưa tới 80 dòng nên không đáng thêm một dependency. Thiếu so với Framer Motion là không có hiệu ứng lò xo thật, và người bị đẩy sang trang khác thì biến mất ngay chứ không có animation đi ra. Có tôn trọng `prefers-reduced-motion`.

Về bố cục, trên desktop 2 cột được tạo bằng `grid-auto-flow: column`. Thứ tự trong HTML vẫn là 1, 2, 3… nên trình đọc màn hình và bản mobile 1 cột không phải xử lý gì thêm. Trên mobile, chọn tháng bằng `<select>` của hệ điều hành cho gọn, không phải vuốt ngang, và ô hạng của tôi dính ở đáy màn hình.

Font dùng Barlow Condensed cho tiêu đề và con số để có cảm giác bảng tỉ số, Be Vietnam Pro cho chữ thường vì hiển thị dấu tiếng Việt tốt.

## 05. Những gì chưa làm và nếu lên production

- Mock chạy trong trình duyệt nên mỗi tab có một bộ dữ liệu riêng. Backend thật mình sẽ dùng Redis Sorted Set, hoặc DB có index `(score DESC, reached_at, id)`, và có lẽ chuyển sang phân trang bằng cursor để khỏi phải giữ snapshot đầy đủ.
- Tháng và trang chưa nằm trên URL, nên chưa gửi link được và nút Back của trình duyệt không quay lại trang trước. Thêm `?month=&page=` là xong.
- Socket thật cần tự nối lại kèm backoff, heartbeat, xác thực, và server nên gom sự kiện nếu mỗi giây có hàng nghìn thay đổi.
- Lỗi mạng hiện chỉ có nút thử lại, chưa tự retry.
- Tạm dừng khi rê chuột chỉ có tác dụng với chuột. Trên điện thoại có thể cân nhắc tạm dừng khi người dùng đang cuộn.
- Chưa xử lý trường hợp tháng chốt đúng lúc đang xem, cũng chưa chốt múi giờ (nên để server quyết, theo giờ Việt Nam).
- Avatar đang lấy từ dịch vụ ngoài. Thực tế nên để trên CDN riêng và qua `next/image`.
- Test mới có phần domain. Còn thiếu test cho hook (nhất là các trường hợp race) và test e2e bằng Playwright.
"# alta-interview" 
