import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { GetUserOutputDto } from './dto/get-user.dto';
import { ErrorCode } from '../common/errors/error-code.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    try {
      // 중복 이메일 검증
      const exists = await this.userRepo.findOne({
        where: { email: dto.email },
      });

      if (exists) {
        throw new ConflictException({
          code: ErrorCode.USER_EMAIL_DUPLICATED,
          message: '이미 가입된 이메일입니다.',
        });
      }

      const user = this.userRepo.create({
        email: dto.email,
        password: dto.password,
        role: dto.role,
      });

      return this.userRepo.save(user);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new Error('회원가입 도중 알 수 없는 에러가 발생하였습니다.');
    }
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const { email, password } = dto;

    // 유저의 아이디가 존재하는지와 비밀번호가 일치하지 않는지 명확한 답을 내려주지 않는 이유
    // 나의 생각 : 정보 탈취자가 아이디와 비밀번호를 탈취를 하겠다고 마음을 먹으면 모두 탈취해 갈 수 있는데
    // 이로 인해 사용자 허들만 높아지는 것이 아닌가?
    // 이에 대한 답을 찾아본 결과 완벽한 보안을 설정하기 위함이 아니라 보안 비용을 높이기 위함이다.
    // 모든 정보 탈취자는 전문 공격자가 아니며 대부분의 공격자는 이메일 존재 수집, 무작위 대입 등을 통해 정보를 얻으려고 함
    // 이 때 이메일 리스트를 통해 존재하는 이메일만을 수집할 수 있으며 이 자체가 정보 탈취라 볼 수 있음
    // 이것을 User Enumeration공격이라고 함.
    const user = await this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'role'],
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    const passwordConfirm = await bcrypt.compare(password, user.password);

    if (!passwordConfirm) {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    let accessToken;
    try {
      accessToken = await this.jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'JWT 에러 : 환경설정 및 payload값을 확인해주세요.',
      );
    }

    return { accessToken };
  }

  async getUser(userId: number): Promise<GetUserOutputDto> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { subscriptions: true, payments: true },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }
    return new GetUserOutputDto(user);
  }
}
