import { NotesService } from './notes.service';

describe('NotesService error handling', () => {
  it('does not convert database failures into not-found responses', async () => {
    const databaseError = new Error('MongoDB unavailable');
    const model = {
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockRejectedValue(databaseError) }),
    };
    const service = new NotesService(model as never, {} as never);

    await expect(service.findByIdOrThrow('507f1f77bcf86cd799439011'))
      .rejects.toBe(databaseError);
  });
});
