# Prediction Bounty Pool Design

Tai lieu nay mo ta co che Prediction Bounty Pool bang diem cho he thong Horse Race. Muc tieu la game hoa viec du doan ket qua dua, khong dung tien that va tranh thiet ke theo kieu ca cuoc.

## 1. Y Tuong Chinh

Moi cuoc dua co mot bounty pool bang diem. Spectator tham gia bang cach gui du doan top 3 va chon muc rui ro bang so nguyen duong (`riskMultiplier`).

He thong khong dung cac tu `bet`, `wager`, `odds`, `cashout`. Nen dung:

- `Prediction`
- `Risk Multiplier`
- `Entry Points`
- `Bounty Pool`
- `Prediction Score`
- `Reward Points`

## 2. Cau Hinh Chinh

```text
EntryFee = diem co so de tham gia du doan
RiskMultiplier = muc rui ro do spectator chon, chi nhan so nguyen
MinRiskMultiplier = muc thap nhat duoc nhap
MaxRiskMultiplier = muc cao nhat duoc nhap
QuickRiskMultipliers = cac nut goi y nhanh, vi du [1, 2, 3, 6]
```

Frontend co the hien nut nhanh 1x, 2x, 3x, 6x. User van duoc nhap tu ban phim, mien la gia tri la so nguyen va nam trong min/max.

Vi du cau hinh MVP:

```text
EntryFee = 50,000 diem
MinRiskMultiplier = 1
MaxRiskMultiplier = 10
QuickRiskMultipliers = [1, 2, 3, 6]
```

## 3. Cong Thuc Diem Tham Gia

```text
EntryPoints = EntryFee * RiskMultiplier
```

Vi du:

```text
EntryFee = 50,000

User A chon 1x => EntryPoints = 50,000
User B chon 2x => EntryPoints = 100,000
User C chon 6x => EntryPoints = 300,000
```

Neu user sai, phan EntryPoints da dua vao pool se mat. Neu user dung/co diem, EntryPoints lam trong so khi chia phan thuong spectator.

## 4. Tong Bounty Pool

Tong pool la tong EntryPoints cua tat ca prediction trong race.

```text
TotalBountyPool = sum(EntryPoints cua tat ca spectator)
```

Vi du:

```text
User A EntryPoints = 50,000
User B EntryPoints = 100,000
User C EntryPoints = 300,000

TotalBountyPool = 450,000
```

## 5. Ti Le Chia Pool

De xuat cau hinh MVP:

```text
OrganizerFeeRate = 10%
RacingRewardRate = 15%
SpectatorRewardRate = 75%
```

Cong thuc:

```text
OrganizerFee = TotalBountyPool * OrganizerFeeRate
RacingRewardPool = TotalBountyPool * RacingRewardRate
SpectatorRewardPool = TotalBountyPool * SpectatorRewardRate
```

Vi du:

```text
TotalBountyPool = 1,000,000

OrganizerFee = 1,000,000 * 10% = 100,000
RacingRewardPool = 1,000,000 * 15% = 150,000
SpectatorRewardPool = 1,000,000 * 75% = 750,000
```

## 6. Chia RacingRewardPool Cho Owner Va Jockey

RacingRewardPool chia cho cac ngua co thu hang theo `RankRewardRates`.

MVP de xuat:

```text
RankRewardRates = [50%, 25%, 15%, 7%, 3%]
```

Nghia la:

```text
Rank 1 nhan 50% RacingRewardPool
Rank 2 nhan 25% RacingRewardPool
Rank 3 nhan 15% RacingRewardPool
Rank 4 nhan 7% RacingRewardPool
Rank 5 nhan 3% RacingRewardPool
```

Neu co 2 ngua cung hang, cac ngua cung hang chia deu phan thuong cua hang do.

Moi phan thuong cua ngua lai chia tiep cho owner va jockey:

```text
OwnerShareRate = 80%
JockeyShareRate = 20%

OwnerReward = HorseRankReward * OwnerShareRate
JockeyReward = HorseRankReward * JockeyShareRate
```

Vi du:

```text
RacingRewardPool = 150,000
Rank 1 Reward = 150,000 * 50% = 75,000

OwnerReward = 75,000 * 80% = 60,000
JockeyReward = 75,000 * 20% = 15,000
```

## 7. Cham Prediction Score

Spectator du doan top 3. Cong thuc cham diem MVP:

```text
Dung hang 1 chinh xac: +50
Dung hang 2 chinh xac: +40
Dung hang 3 chinh xac: +30
Ngua nam trong top 3 nhung sai vi tri: +15
Sai hoan toan: +0
```

Vi du:

```text
Du doan:
1. Horse A
2. Horse B
3. Horse C

Ket qua:
1. Horse A
2. Horse C
3. Horse D

Horse A dung hang 1: +50
Horse C nam trong top 3 nhung sai vi tri: +15
Horse B khong nam trong top 3: +0

PredictionScore = 65
```

## 8. Chia SpectatorRewardPool

Chi prediction co `PredictionScore > 0` moi duoc chia `SpectatorRewardPool`.

Voi co che linh hoat, phan thuong phu thuoc vao ca do chinh xac va muc rui ro:

```text
PredictionWeight = EntryPoints * PredictionScore
TotalPredictionWeight = sum(PredictionWeight cua cac prediction co PredictionScore > 0)

UserReward = PredictionWeight / TotalPredictionWeight * SpectatorRewardPool
```

Vi du:

```text
SpectatorRewardPool = 750,000
EntryFee = 50,000

User A: Risk 1x, EntryPoints 50,000, Score 100
User B: Risk 2x, EntryPoints 100,000, Score 100
User C: Risk 1x, EntryPoints 50,000, Score 50
```

Tinh trong so:

```text
User A Weight = 50,000 * 100 = 5,000,000
User B Weight = 100,000 * 100 = 10,000,000
User C Weight = 50,000 * 50 = 2,500,000

TotalPredictionWeight = 17,500,000
```

Chia thuong:

```text
User A Reward = 5,000,000 / 17,500,000 * 750,000 = 214,285
User B Reward = 10,000,000 / 17,500,000 * 750,000 = 428,571
User C Reward = 2,500,000 / 17,500,000 * 750,000 = 107,142
```

Ket luan: neu hai user cung doan dung nhu nhau, user chon 2x se co trong so gap doi user chon 1x. Neu doan sai, user khong duoc chia SpectatorRewardPool.

## 9. Truong Hop Khong Ai Co Diem

Neu khong prediction nao co `PredictionScore > 0`:

```text
TotalPredictionWeight = 0
```

He thong khong chia `SpectatorRewardPool`. Chinh sach hien tai co the:

```text
RolloverPolicy = refund | rollover_next_race | to_organizer
```

Huong nen dung cho game:

```text
rollover_next_race
```

Phan spectator pool se thanh jackpot cho race sau.

## 10. Flow Thuc Te

```text
1. Admin cau hinh predictionConfig cho tournament.
2. Spectator mo race va gui predictedRanks + riskMultiplier.
3. Backend validate riskMultiplier la so nguyen trong min/max.
4. Backend tinh EntryPoints = EntryFee * RiskMultiplier.
5. Backend tru EntryPoints tu spectator profile.
6. Backend cong EntryPoints vao PredictionPool.
7. Referee/admin publish result.
8. Backend cham PredictionScore.
9. Backend tinh PredictionWeight = EntryPoints * PredictionScore.
10. Backend chia pool cho organizer, owner/jockey, spectator.
11. Backend ghi point transaction va notification.
```

## 11. Tom Tat Mot Cau

Prediction Bounty Pool la hu thuong diem linh hoat: spectator du doan top 3 va chon risk multiplier bang so nguyen, he thong tinh EntryPoints = EntryFee * RiskMultiplier, tong EntryPoints tao pool, pool chia 10% cho he thong, 15% cho owner/jockey, 75% cho nguoi du doan co diem theo cong thuc EntryPoints * PredictionScore.
