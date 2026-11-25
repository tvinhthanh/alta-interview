import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paginate, pageWindow, diffEntries, rankPlayers, sameRows, reachesPosition, type ChangeEvent, type Player } from './ranking.ts'

const p = (id: string, score: number, reachedAt = 0): Player => ({ id, name: id, score, reachedAt })

test('xếp theo điểm, không theo thứ tự nhận dữ liệu', () => {
  const ranked = rankPlayers([p('a', 100), p('b', 300), p('c', 200)])
  assert.deepEqual(ranked.map((e) => e.id), ['b', 'c', 'a'])
  assert.deepEqual(ranked.map((e) => e.rank), [1, 2, 3])
})

test('bằng điểm thì cùng hạng, người kế tiếp lấy hạng liền sau (1, 2, 2, 3)', () => {
  const ranked = rankPlayers([p('a', 500), p('b', 400, 2), p('c', 400, 1), p('d', 300)])
  assert.deepEqual(ranked.map((e) => [e.id, e.rank, e.tied]), [
    ['a', 1, false],
    ['c', 2, true], // đạt 400 điểm trước nên đứng trên
    ['b', 2, true],
    ['d', 3, false],
  ])
})

test('nhóm đồng hạng vắt qua ranh giới trang: không lặp, không sót', () => {
  // 4 người cùng 90 điểm chiếm vị trí 9–12: hai người cuối trang 1, hai người đầu trang 2
  const score = (i: number) => (i < 8 ? 100 - i : i <= 11 ? 90 : 80 - i)
  const players = Array.from({ length: 23 }, (_, i) => p(`p${i}`, score(i), i)).reverse()
  const ranked = rankPlayers(players)
  const page1 = paginate(ranked, 1, 10).items
  const page2 = paginate(ranked, 2, 10).items
  const page3 = paginate(ranked, 3, 10).items

  const ids = [...page1, ...page2, ...page3].map((e) => e.id)
  assert.equal(new Set(ids).size, 23)
  assert.equal(page1.at(-1)!.rank, 9)
  assert.equal(page2[0].rank, 9) // trang 2 mở đầu bằng #9, không phải #11
  assert.equal(page2[2].rank, 10) // phía trên có 9 mức điểm nên là hạng 10
})

test('trang vượt quá tổng số trang bị kéo về trang cuối', () => {
  const ranked = rankPlayers(Array.from({ length: 12 }, (_, i) => p(`p${i}`, i)))
  assert.equal(paginate(ranked, 9, 10).page, 2)
  assert.equal(paginate([], 3, 10).page, 1)
})

test('cửa sổ phân trang luôn cùng số ô', () => {
  assert.deepEqual(pageWindow(1, 10), [1, 2, 3, 4, 5, 'gap', 10])
  assert.deepEqual(pageWindow(5, 10), [1, 'gap', 4, 5, 6, 'gap', 10])
  assert.deepEqual(pageWindow(9, 10), [1, 'gap', 6, 7, 8, 9, 10])
  assert.deepEqual(pageWindow(2, 5), [1, 2, 3, 4, 5])
  assert.deepEqual(pageWindow(1, 1), [1])
  for (let page = 1; page <= 20; page++) assert.equal(pageWindow(page, 20).length, 7)
})

test('diff giữa hai lần xem: đổi hạng, đổi điểm, người mới vào trang', () => {
  const before = rankPlayers([p('a', 300), p('b', 200), p('c', 100)])
  const after = rankPlayers([p('a', 300), p('b', 200), p('c', 400), p('d', 250)])
  assert.deepEqual(diffEntries(before, after), {
    c: { move: 2, scoreDelta: 300, entered: false },
    a: { move: -1, scoreDelta: 0, entered: false },
    d: { move: 0, scoreDelta: 0, entered: true },
    b: { move: -2, scoreDelta: 0, entered: false },
  })
})

test('người từ trang khác lên vẫn có mũi tên tăng hạng nhờ hạng cũ server trả về', () => {
  const before = rankPlayers([p('a', 300), p('b', 200)])
  const after = rankPlayers([p('x', 900), p('a', 300)])
  assert.deepEqual(diffEntries(before, after, { x: { rank: 18, score: 100 } }), {
    x: { move: 17, scoreDelta: 800, entered: true },
    a: { move: -1, scoreDelta: 0, entered: false },
  })
})

test('trang không đổi thì coi là giống nhau, đổi điểm hay hạng thì khác', () => {
  const a = rankPlayers([p('a', 300), p('b', 200)])
  assert.equal(sameRows(a, rankPlayers([p('b', 200), p('a', 300)])), true)
  assert.equal(sameRows(a, rankPlayers([p('a', 300), p('b', 210)])), false)
})

test('thay đổi ở vị trí p chỉ ảnh hưởng các dòng từ p trở xuống', () => {
  const ev = (fromPosition: number | null, toPosition: number): ChangeEvent =>
    ({ monthId: 'm', revision: 2, kind: 'score', playerId: 'x', fromPosition, toPosition, total: 50 })
  assert.equal(reachesPosition(ev(40, 20), 10), false) // hạng 20–40 đổi, top 10 giữ nguyên
  assert.equal(reachesPosition(ev(40, 5), 10), true)
  assert.equal(reachesPosition(ev(30, 11), 10), true) // vào sát dưới trang: đồng hạng của dòng 10 có thể đổi
  assert.equal(reachesPosition(ev(null, 49), 10), false) // người mới vào cuối bảng
  assert.equal(reachesPosition(ev(null, 3), 50), true) // người mới vào top 3 đẩy cả trang 5 xuống
  assert.equal(reachesPosition(ev(3, 3), 20), true) // không đổi chỗ nhưng tạo đồng hạng, hạng trang 2 lùi 1
  assert.equal(reachesPosition(ev(25, 25), 10), false) // thay đổi bên dưới không ảnh hưởng hạng phía trên
})
