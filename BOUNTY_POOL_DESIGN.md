# Prediction Bounty Pool Design

Tai lieu nay mo ta co che Prediction Bounty Pool bang diem cho he thong Horse Race. Muc tieu la dua co che du doan vao thuc te theo huong game hoa, khong dung tien that va khong thiet ke nhu ca cuoc.

## 1. Y Tuong Chinh

Prediction Bounty Pool la "hu thuong diem" cua moi cuoc dua. Spectator tham gia du doan bang cach mua mot ve du doan voi gia diem co dinh. Tong diem tu cac ve tao thanh bounty pool.

Sau khi race ket thuc va ket qua duoc referee/admin xac nhan, he thong se:

1. Tinh tong bounty pool.
2. Tach phan cho ban to chuc/he thong.
3. Tach phan thuong cho owner/jockey cua ngua chien thang.
4. Chia phan con lai cho spectator du doan dung theo do chinh xac.

Mo hinh nay giu duoc cam giac canh tranh va thuong phat, nhung van la diem noi bo thay vi tien that.

## 2. Nguyen Tac Thiet Ke

- TicketPrice la co dinh.
- TotalBountyPool la linh hoat theo so nguoi tham gia.
- Ti le chia pool la co dinh de de giai thich va de demo.
- Spectator reward phu thuoc vao PredictionScore, khong phu thuoc vao viec user "cuoc nhieu hay it".
- Khong dung thuat ngu `bet`, `wager`, `cashout`, `odds`.
- Nen dung cac thuat ngu:
  - `Prediction Ticket`
  - `Bounty Pool`
  - `Prediction Score`
  - `Reward Points`
  - `Organizer Fee`
  - `Racing Reward`

## 3. Cong Thuc Tao Pool

Moi spectator tra mot luong diem co dinh de tham gia du doan.

```text
TicketPrice = gia ve du doan co dinh
NumberOfParticipants = so spectator tham gia race

TotalBountyPool = TicketPrice * NumberOfParticipants
```

Vi du:

```text
TicketPrice = 50,000 diem
NumberOfParticipants = 20

TotalBountyPool = 50,000 * 20 = 1,000,000 diem
```

## 4. Ti Le Chia Bounty Pool

De xuat dung ti le:

```text
OrganizerFee = 10%
RacingRewardPool = 15%
SpectatorRewardPool = 75%
```

Trong do:

```text
OrganizerFee:
Phan ban to chuc/he thong giu lai. Co the xem la phi van hanh hoac diem bi rut khoi he thong de chong lam phat diem.

RacingRewardPool:
Phan thuong them cho owner va jockey cua ngua chien thang.

SpectatorRewardPool:
Phan chia cho spectator du doan co diem.
```

Cong thuc:

```text
OrganizerFee = TotalBountyPool * 10%
RacingRewardPool = TotalBountyPool * 15%
SpectatorRewardPool = TotalBountyPool * 75%
```

Vi du:

```text
TotalBountyPool = 1,000,000 diem

OrganizerFee = 1,000,000 * 10% = 100,000 diem
RacingRewardPool = 1,000,000 * 15% = 150,000 diem
SpectatorRewardPool = 1,000,000 * 75% = 750,000 diem
```

## 5. Chia RacingRewardPool Cho Owner Va Jockey

Phan `RacingRewardPool` thuong cho doi dua cua ngua thang cuoc.

De xuat:

```text
OwnerShare = 80%
JockeyShare = 20%
```

Cong thuc:

```text
OwnerReward = RacingRewardPool * 80%
JockeyReward = RacingRewardPool * 20%
```

Vi du:

```text
RacingRewardPool = 150,000 diem

OwnerReward = 150,000 * 80% = 120,000 diem
JockeyReward = 150,000 * 20% = 30,000 diem
```

Ghi chu:

- Neu race chi can thuong ngua hang 1, `RacingRewardPool` trao cho owner/jockey cua ngua hang 1.
- Neu muon mo rong sau nay, co the chia `RacingRewardPool` cho top 3 hoac top 5 ngua theo thu hang.

Vi du top 3:

```text
Rank 1: 60% RacingRewardPool
Rank 2: 25% RacingRewardPool
Rank 3: 15% RacingRewardPool
```

Sau do moi `HorseRacingReward` lai chia tiep:

```text
OwnerReward = HorseRacingReward * 80%
JockeyReward = HorseRacingReward * 20%
```

## 6. Co Che Du Doan Cho Spectator

Voi race co 10-12 ngua, MVP nen cho spectator du doan top 3.

User se chon:

```text
Rank 1 prediction
Rank 2 prediction
Rank 3 prediction
```

Khong nen bat user du doan toan bo 10-12 ngua, vi qua kho, kho demo va lam trai nghiem bi nang.

## 7. Cong Thuc Cham PredictionScore

De xuat scoring:

```text
Dung hang 1 chinh xac: +50
Dung hang 2 chinh xac: +40
Dung hang 3 chinh xac: +30
Ngua nam trong top 3 nhung sai vi tri: +15
Sai hoan toan: +0
```

Vi du:

```text
Du doan cua user:
1. Horse A
2. Horse B
3. Horse C

Ket qua that:
1. Horse A
2. Horse C
3. Horse D
```

Tinh diem:

```text
Horse A dung hang 1: +50
Horse C nam trong top 3 nhung sai vi tri: +15
Horse B khong nam trong top 3: +0

PredictionScore = 65
```

## 8. Chia SpectatorRewardPool Cho Nguoi Du Doan

Chi spectator co `PredictionScore > 0` moi duoc chia thuong.

Cong thuc:

```text
TotalWinnerScore = tong PredictionScore cua tat ca spectator co PredictionScore > 0

UserReward = UserPredictionScore / TotalWinnerScore * SpectatorRewardPool
```

Vi du:

```text
SpectatorRewardPool = 750,000 diem

User A PredictionScore = 100
User B PredictionScore = 60
User C PredictionScore = 40

TotalWinnerScore = 100 + 60 + 40 = 200
```

Thuong tung user:

```text
User A Reward = 100 / 200 * 750,000 = 375,000 diem
User B Reward = 60 / 200 * 750,000 = 225,000 diem
User C Reward = 40 / 200 * 750,000 = 150,000 diem
```

## 9. Vi Du Day Du

Gia su:

```text
TicketPrice = 50,000 diem
NumberOfParticipants = 20
TotalBountyPool = 1,000,000 diem
```

Chia pool:

```text
OrganizerFee = 1,000,000 * 10% = 100,000
RacingRewardPool = 1,000,000 * 15% = 150,000
SpectatorRewardPool = 1,000,000 * 75% = 750,000
```

Chia cho owner/jockey cua ngua thang:

```text
OwnerReward = 150,000 * 80% = 120,000
JockeyReward = 150,000 * 20% = 30,000
```

Chia cho spectator:

```text
User A score = 100
User B score = 60
User C score = 40
TotalWinnerScore = 200

User A Reward = 100 / 200 * 750,000 = 375,000
User B Reward = 60 / 200 * 750,000 = 225,000
User C Reward = 40 / 200 * 750,000 = 150,000
```

Ket qua cuoi:

```text
Ban to chuc/he thong: 100,000 diem
Owner ngua thang: 120,000 diem
Jockey ngua thang: 30,000 diem
Spectator A: 375,000 diem
Spectator B: 225,000 diem
Spectator C: 150,000 diem
```

## 10. Truong Hop Khong Ai Du Doan Dung

Neu:

```text
TotalWinnerScore = 0
```

De xuat khong chia `SpectatorRewardPool`. Chuyen no thanh jackpot cho race tiep theo.

Cong thuc:

```text
NextRaceJackpot = CurrentJackpot + SpectatorRewardPool
```

Neu race sau co jackpot, co the cong vao SpectatorRewardPool:

```text
FinalSpectatorRewardPool = SpectatorRewardPool + CurrentJackpot
```

## 11. Ly Do Khong Nen Cho Stake Linh Hoat Trong MVP

Co the thiet ke theo stake linh hoat:

```text
UserWeightedScore = UserStake * UserPredictionScore
UserReward = UserWeightedScore / TotalWeightedScore * SpectatorRewardPool
```

Nhung MVP khong nen dung cach nay vi:

- Lam he thong giong ca cuoc hon.
- User nhieu diem co loi the qua lon.
- Kho giai thich voi nguoi moi.
- Kho can bang economy diem.

Voi MVP nen chot:

```text
TicketPrice co dinh
Pool linh hoat
Ti le chia co dinh
Reward thuc nhan linh hoat theo PredictionScore
```

## 12. Huong Dua Vao Thuc Tien Trong Code

Co the trien khai theo cac module/domain sau:

### Backend Models

Co the them hoac mo rong:

```text
PredictionPool
- raceId
- ticketPrice
- totalTickets
- totalBountyPool
- organizerFeeRate
- racingRewardRate
- spectatorRewardRate
- ownerShareRate
- jockeyShareRate
- jackpotAmount
- status

Prediction
- raceId
- spectatorId
- predictedRanks
- ticketCost
- predictionScore
- rewardAmount
- status

SpectatorProfile
- pointsBalance
- pointsTransactions

OrganizerLedger
- amount
- type
- raceId
- description
```

### Backend Services

Can co cac service logic:

```text
createOrGetPredictionPool(raceId)
submitPrediction(spectatorId, raceId, predictedRanks)
calculatePredictionScore(predictedRanks, actualRanks)
settlePredictionPool(raceId)
distributeRacingReward(raceId, racingRewardPool)
distributeSpectatorRewards(raceId, spectatorRewardPool)
recordPointTransaction(userId, amount, type, metadata)
```

### Flow Thuc Te

```text
1. Admin tao race.
2. He thong tao PredictionPool cho race hoac tao khi spectator dau tien tham gia.
3. Spectator mua Prediction Ticket bang diem.
4. He thong tru diem spectator va luu Prediction.
5. Race ket thuc.
6. Referee/admin publish result.
7. He thong settle pool:
   - tinh TotalBountyPool
   - tach OrganizerFee
   - tach RacingRewardPool
   - tach SpectatorRewardPool
   - cham diem prediction
   - chia diem thuong
   - ghi ledger/transaction
8. FE/FE_mobile hien thi reward va lich su diem.
```

## 13. Cau Hinh De Xuat Cho MVP

```text
TicketPrice = 50,000
OrganizerFeeRate = 10%
RacingRewardRate = 15%
SpectatorRewardRate = 75%
OwnerShareRate = 80%
JockeyShareRate = 20%

PredictionMode = TOP_3
ExactRank1Score = 50
ExactRank2Score = 40
ExactRank3Score = 30
WrongPositionTop3Score = 15
NoMatchScore = 0
```

## 14. Tom Tat Mot Cau

Prediction Bounty Pool la co che hu thuong diem linh hoat: spectator mua ticket co dinh de du doan, tong ticket tao thanh pool, pool chia 10% cho he thong, 15% cho owner/jockey cua ngua thang, 75% cho nguoi du doan dung theo PredictionScore.
