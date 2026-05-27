import { Race } from '../models/Race.model.js';
import type { IRace } from '../models/Race.model.js';
import { Tournament } from '../models/Tournament.model.js';
import { HttpError } from '../utils/http-error.js';

export class RaceService {
  async createRace(data: Partial<IRace>) {
    // Ràng buộc quan trọng: Kiểm tra giải đấu có tồn tại không
    const tournamentExists = await Tournament.exists({ _id: data.tournamentId });
    if (!tournamentExists) {
      throw new HttpError(404, 'Giải đấu không tồn tại trong hệ thống. Không thể xếp lịch trận đua!');
    }

    const race = new Race(data);
    return await race.save();
  }

  async getRacesByTournament(tournamentId: string) {
    return await Race.find({ tournamentId })
      .sort({ round: 1, scheduledAt: 1 }); // Sắp xếp theo vòng đua và thời gian
  }
async getRaceById(id: string) {
    return await Race.findById(id)
      .populate('participants.horseId', 'name breed')
      .populate('participants.jockeyId', 'fullName');
  }

  async addParticipantToRace(raceId: string, participantData: any) {
    const race = await Race.findById(raceId);
    if (!race) return null;

    race.participants.push(participantData);
    return await race.save();
  }

  async updateRaceStatus(raceId: string, status: IRace['status']) {
    const race = await Race.findById(raceId);
    if (!race) return null;

    race.status = status;
    return await race.save(); // Gọi .save() để kích hoạt các hàm kiểm tra an toàn pre('save') trong Model
  }
}