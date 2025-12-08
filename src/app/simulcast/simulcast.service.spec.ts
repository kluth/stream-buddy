import { Test, TestingModule } from '@nestjs/testing';
import { SimulcastService } from './simulcast.service';

describe('SimulcastService', () => {
  let service: SimulcastService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SimulcastService],
    }).compile();

    service = module.get<SimulcastService>(SimulcastService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
