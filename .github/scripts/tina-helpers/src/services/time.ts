import Dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
Dayjs.extend(utc);
class Time {
    static getNow() {
        const day = Dayjs().utc().startOf('hour');
        return day;
    }
}

export default Time;