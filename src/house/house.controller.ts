import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { HouseService } from './house.service';
import { CreateHouseDto, UpdateHouseDto } from './dto/house.dto';
import { Permissions } from '../auth/permissions.decorator';
import { Permission } from '../auth/permission.enum';

@Controller('houses')
export class HouseController {
  constructor(private readonly houseService: HouseService) {}

  @Post()
  @Permissions(Permission.HOUSE_CREATE)
  create(@Body() dto: CreateHouseDto) {
    return this.houseService.create(dto);
  }

  @Get()
  @Permissions(Permission.HOUSE_READ)
  findAll() {
    return this.houseService.findAll();
  }

  @Get(':id')
  @Permissions(Permission.HOUSE_READ)
  findOne(@Param('id') id: string) {
    return this.houseService.findOne(id);
  }

  @Put(':id')
  @Permissions(Permission.HOUSE_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateHouseDto) {
    return this.houseService.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.HOUSE_DELETE)
  remove(@Param('id') id: string) {
    return this.houseService.remove(id);
  }

  @Post('auto-allocate')
  @Permissions(Permission.HOUSE_CREATE)
  autoAllocate(
    @Query('standard') standard?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.houseService.autoAllocate({ standard, academicYear });
  }

  @Post('assign-student')
  @Permissions(Permission.HOUSE_UPDATE)
  assignStudent(
    @Body('studentId') studentId: string,
    @Body('houseId') houseId: string,
  ) {
    return this.houseService.assignStudent(studentId, houseId);
  }

  @Post('remove-student/:studentId')
  @Permissions(Permission.HOUSE_UPDATE)
  removeStudent(@Param('studentId') studentId: string) {
    return this.houseService.removeStudent(studentId);
  }
}
