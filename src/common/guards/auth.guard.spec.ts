import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  };
  const config = { get: jest.fn() };
  const request = { header: jest.fn() };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
    request.header.mockReturnValue(undefined);
  });

  it('allows public routes without a key', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    config.get.mockReturnValue('secret');
    expect(new AuthGuard(reflector as never, config as never).canActivate(context as never)).toBe(true);
  });

  it('keeps local development open when no API key is configured', () => {
    config.get.mockReturnValue('');
    expect(new AuthGuard(reflector as never, config as never).canActivate(context as never)).toBe(true);
  });

  it('accepts a configured API key and rejects an invalid one', () => {
    config.get.mockReturnValue('secret');
    request.header.mockImplementation((name: string) =>
      name === 'x-api-key' ? 'secret' : undefined,
    );
    const guard = new AuthGuard(reflector as never, config as never);
    expect(guard.canActivate(context as never)).toBe(true);

    request.header.mockReturnValue('wrong');
    expect(() => guard.canActivate(context as never)).toThrow(UnauthorizedException);
  });

  it('fails closed in production when the API key is missing', () => {
    config.get.mockImplementation((key: string) =>
      key === 'app.nodeEnv' ? 'production' : '',
    );
    expect(() => new AuthGuard(reflector as never, config as never).canActivate(context as never))
      .toThrow(UnauthorizedException);
  });
});
