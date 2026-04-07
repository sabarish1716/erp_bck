import { Body, Controller, Get, Post, Response } from '@nestjs/common';
import { DriverService } from './driver.service';

@Controller('transports')
export class DriverController {
    constructor(private readonly driverService: DriverService) {}

    // import service and inject in constructor when needed for driver-related operations


    // This controller is currently empty, but can be used for driver-related endpoints in the future.  

    // get all drivers
    // @Get('drivers')
    // getAllDrivers() {
    //     return  this.driverService.findAll();
    // }
    @Post('drivers')
    createDriver(@Response() res: any, @Body() createDriverDto: any) {

        // For demonstration, we will create a driver with hardcoded values.
        // In a real application, you would accept these as parameters in the request body.
        const { name, email, phone ,busId,} = createDriverDto;
        const newDriver = this.driverService.create(name, email, phone, busId);
        return res.status(201).json(newDriver);
    }
}