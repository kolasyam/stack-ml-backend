import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const storage = {
    upload: jest.fn(),
    createSignedUrl: jest.fn(),
    remove: jest.fn(),
    isSafeStoragePath: (path: string) =>
      path.startsWith('uploads/') && !path.includes('..'),
  };
  const config = {
    get: jest.fn().mockReturnValue({
      allowedFileTypes: ['pdf', 'doc', 'docx'],
      maxFileSizeMb: 1,
    }),
  };

  beforeEach(() => jest.clearAllMocks());

  it('accepts a PDF whose file signature matches its extension', async () => {
    const result = { path: 'uploads/2026/10/file.pdf' };
    storage.upload.mockResolvedValue(result);
    const service = new UploadsService(storage as never, config as never);
    const file = {
      originalname: 'notes.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\ncontent'),
    } as Express.Multer.File;

    await expect(service.upload(file)).resolves.toEqual(result);
    expect(storage.upload).toHaveBeenCalledWith(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  });

  it('rejects extension/content mismatches before storage is called', async () => {
    const service = new UploadsService(storage as never, config as never);
    const file = {
      originalname: 'notes.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('not a pdf'),
    } as Express.Multer.File;

    await expect(service.upload(file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects storage paths outside the application upload prefix', async () => {
    const service = new UploadsService(storage as never, config as never);

    await expect(service.signedUrl('../private.env')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });
});
