# Winner Prediction Bounty Pool Design

Tai lieu nay mo ta co che bounty pool MVP cho Horse Race. Ban hien tai chi lam mot viec don gian: spectator chon ngua ve nhat.

He thong dung diem noi bo, khong dung tien that. Trong UI va API nen dung cac tu:

- `Prediction`
- `Winner Prediction`
- `Risk Multiplier`
- `Entry Points`
- `Win Pool`
- `Prize Pool`
- `Reward Points`

Tranh dung cac tu: `bet`, `wager`, `odds`, `cashout`.

## 1. Luong Chinh

```text
1. Spectator chon 1 con ngua ve nhat.
2. Spectator chon riskMultiplier, vi du 1x, 2x, 3x, 6x.
3. Backend tinh EntryPoints.
4. Backend tru EntryPoints cua spectator khi gui du doan.
5. Race ket thuc va admin/referee publish result.
6. Backend tach nguoi doan dung va nguoi doan sai.
7. Diem cua nguoi doan dung duoc hoan lai.
8. Diem cua nguoi doan sai gom thanh WinPool.
9. WinPool chia 10% cho organizer, 15% cho horse, 75% thanh PrizePool.
10. PrizePool chia cho nguoi doan dung theo ty le EntryPoints cua tung nguoi.
```

## 2. Entry Points

```text
EntryFee = diem co so de tham gia du doan
RiskMultiplier = muc rui ro, chi nhan so nguyen duong

EntryPoints = EntryFee * RiskMultiplier
```

Vi du:

```text
EntryFee = 50,000

User A chon 1x => EntryPoints = 50,000
User B chon 2x => EntryPoints = 100,000
User C chon 6x => EntryPoints = 300,000
```

`riskMultiplier` chi duoc la so nguyen. Hop le: `1`, `2`, `3`, `6`, `10`. Khong hop le: `1.5`, `1.75`, `2.5`.

## 3. Xac Dinh Dung Sai

MVP chi xet ngua ve nhat.

```text
Neu predictedHorseId == actualRank1HorseId:
  prediction dung

Nguoc lai:
  prediction sai
```

Khong cham top 2, top 3, sai vi tri, hay prediction score phuc tap trong MVP nay.

## 4. Win Pool

Nguoi doan dung duoc giu lai/hoan lai EntryPoints cua minh.

Diem cua nguoi doan sai bi gom vao `WinPool`.

```text
WinPool = sum(EntryPoints cua tat ca prediction sai)
```

Vi du:

```text
User A dung, EntryPoints = 50,000
User B sai, EntryPoints = 100,000
User C sai, EntryPoints = 300,000

WinPool = 100,000 + 300,000 = 400,000
```

## 5. Chia Win Pool

Ti le MVP:

```text
OrganizerFeeRate = 10%
RacingRewardRate = 15%
PrizePoolRate = 75%
```

Cong thuc:

```text
OrganizerFee = WinPool * 10%
RacingRewardPool = WinPool * 15%
PrizePool = WinPool * 75%
```

Vi du:

```text
WinPool = 400,000

OrganizerFee = 400,000 * 10% = 40,000
RacingRewardPool = 400,000 * 15% = 60,000
PrizePool = 400,000 * 75% = 300,000
```

## 6. Chia Cho Horse Owner Va Jockey

`RacingRewardPool` chi trao cho ngua ve nhat trong MVP.

Neu co nhieu ngua cung rank 1, cac ngua rank 1 chia deu `RacingRewardPool`.

Trong tung ngua, owner va jockey chia nhu cu:

```text
OwnerShareRate = 80%
JockeyShareRate = 20%

OwnerReward = HorseReward * 80%
JockeyReward = HorseReward * 20%
```

Vi du:

```text
RacingRewardPool = 60,000

OwnerReward = 60,000 * 80% = 48,000
JockeyReward = 60,000 * 20% = 12,000
```

## 7. Chia Prize Pool Cho Nguoi Doan Dung (Risk-Weighted)

Nguoi doan dung nhan:

```text
TotalReturned = EntryPoints + PrizeReward
```

PrizePool duoc chia theo `PredictionScore` co TRONG SO RUI RO, khong chia theo
EntryPoints thuan. Muc dich: dam risk cao ma doan dung thi phan thuong tang theo
risk^2, nho do `riskMultiplier` la mot lua chon chien luoc that su.

```text
PredictionScore = EntryPoints * RiskMultiplier
                = (EntryFee * RiskMultiplier) * RiskMultiplier
                = EntryFee * RiskMultiplier^2     (chi tinh cho nguoi doan dung)

TotalWinnerScore = sum(PredictionScore cua tat ca prediction dung)

PrizeReward = PrizePool * (PredictionScore / TotalWinnerScore)
```

Phan du do lam tron (floor) duoc don cho nguoi co PredictionScore cao nhat de
khong that thoat diem.

Vi du:

```text
PrizePool = 300,000

User A dung, EntryPoints = 50,000,  risk 1x => PredictionScore = 50,000
User D dung, EntryPoints = 100,000, risk 2x => PredictionScore = 200,000

TotalWinnerScore = 250,000
```

Chia prize:

```text
User A PrizeReward = 300,000 * (50,000 / 250,000)  = 60,000
User D PrizeReward = 300,000 * (200,000 / 250,000) = 240,000
```

Tong diem user nhan lai:

```text
User A TotalReturned = 50,000  + 60,000  = 110,000   (von 50k  -> lai 1.2x)
User D TotalReturned = 100,000 + 240,000 = 340,000   (von 100k -> lai 2.4x)
```

So voi cach chia cu (theo EntryPoints thuan), User D dam risk 2x nhan nhieu hon
(240k thay vi 200k), con User A risk 1x nhan it hon (60k thay vi 100k).

## 8. Vi Du Day Du

Gia su:

```text
EntryFee = 50,000

User A chon Horse 1, risk 1x, EntryPoints = 50,000
User B chon Horse 2, risk 2x, EntryPoints = 100,000
User C chon Horse 3, risk 6x, EntryPoints = 300,000
User D chon Horse 1, risk 2x, EntryPoints = 100,000

Ket qua: Horse 1 ve nhat
```

Nguoi dung:

```text
User A dung
User D dung
User B sai
User C sai
```

WinPool:

```text
WinPool = User B 100,000 + User C 300,000 = 400,000
```

Chia WinPool:

```text
OrganizerFee = 400,000 * 10% = 40,000
RacingRewardPool = 400,000 * 15% = 60,000
PrizePool = 400,000 * 75% = 300,000
```

Chia horse:

```text
OwnerReward = 60,000 * 80% = 48,000
JockeyReward = 60,000 * 20% = 12,000
```

Chia spectator dung (theo PredictionScore = EntryPoints * risk):

```text
User A score = 50,000 * 1  = 50,000
User D score = 100,000 * 2 = 200,000
TotalWinnerScore = 250,000

User A PrizeReward = 300,000 * (50,000 / 250,000)  = 60,000
User D PrizeReward = 300,000 * (200,000 / 250,000) = 240,000
```

Tong tra ve:

```text
User A TotalReturned = 50,000  + 60,000  = 110,000
User D TotalReturned = 100,000 + 240,000 = 340,000
```

## 9. Truong Hop Dac Biet

Neu khong ai doan dung:

```text
TotalCorrectEntryPoints = 0
```

He thong khong co ai de chia `PrizePool`. MVP hien tai de `PrizePool` vao `jackpotAmount` trong pool de co the xu ly sau.

Neu khong ai doan sai:

```text
WinPool = 0
```

Thi:

```text
OrganizerFee = 0
RacingRewardPool = 0
PrizePool = 0
```

Nguoi doan dung chi duoc hoan lai EntryPoints cua minh.

## 10. Tom Tat Mot Cau

MVP bounty pool chi cho spectator chon ngua ve nhat: nguoi doan dung duoc hoan EntryPoints, diem cua nguoi doan sai tao thanh WinPool, WinPool chia 10% organizer, 15% horse owner/jockey, 75% PrizePool chia lai cho nguoi doan dung theo PredictionScore co trong so rui ro (EntryPoints * RiskMultiplier) — dam risk cao ma doan dung thi nhan phan lon hon.
