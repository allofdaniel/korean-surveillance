"""

UBIKAIS FPL Schedule Crawler - ????? ???? ???????????? ????????????

??????? 2025-12-29

??????: UBIKAIS????? ??????/????? ????????????????????????????JSON/SQLite???????

"""



import time

import json

import sqlite3

from datetime import datetime, timedelta

from selenium import webdriver

from selenium.webdriver.common.by import By

from selenium.webdriver.support.ui import WebDriverWait

from selenium.webdriver.support import expected_conditions as EC

from selenium.common.exceptions import TimeoutException

import logging

import sys

import os



# Windows ???????????? ????????????

if sys.platform == 'win32':

    try:

        import codecs

        if hasattr(sys.stdout, 'detach'):

            sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())

            sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())

        os.environ['PYTHONIOENCODING'] = 'utf-8'

    except:

        pass



# ?????? ?????

logging.basicConfig(

    level=logging.INFO,

    format='%(asctime)s - %(levelname)s - %(message)s',

    handlers=[

        logging.StreamHandler(sys.stdout)

    ]

)

logger = logging.getLogger(__name__)



def _require_env_var(name):

    value = os.environ.get(name, '').strip()

    if not value:

        raise RuntimeError(f"Environment variable '{name}' is required for UBIKAIS login")

    return value







class UBIKAISCrawler:

    def __init__(self, db_name='ubikais_schedule.db', headless=True):

        self.login_url = 'https://ubikais.fois.go.kr:8030/common/login?systemId=sysUbikais'

        self.dep_url = 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/dep'

        self.arr_url = 'https://ubikais.fois.go.kr:8030/sysUbikais/biz/fpl/arr'



        self.username = _require_env_var('UBIKAIS_USERNAME')

        self.password = _require_env_var('UBIKAIS_PASSWORD')



        self.db_name = db_name

        self.headless = headless

        self.json_output = 'flight_schedule.json'



        self.setup_database()

        logger.info("[OK] UBIKAIS ????????????????????")



    def setup_database(self):

        """SQLite ??????????????? ????????"""

        conn = sqlite3.connect(self.db_name)

        cursor = conn.cursor()



        # ?????? ???????????????

        cursor.execute('''

            CREATE TABLE IF NOT EXISTS flight_schedules (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                crawl_timestamp TEXT,

                schedule_type TEXT,

                flight_number TEXT,

                aircraft_type TEXT,

                registration TEXT,

                origin TEXT,

                destination TEXT,

                std TEXT,

                etd TEXT,

                atd TEXT,

                sta TEXT,

                eta TEXT,

                status TEXT,

                nature TEXT,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(flight_number, std, origin, destination)

            )

        ''')



        # ?????????????? ????????

        cursor.execute('''

            CREATE TABLE IF NOT EXISTS crawl_logs (

                id INTEGER PRIMARY KEY AUTOINCREMENT,

                crawl_timestamp TEXT,

                schedule_type TEXT,

                status TEXT,

                records_found INTEGER,

                records_saved INTEGER,

                error_message TEXT,

                execution_time REAL,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            )

        ''')



        conn.commit()

        conn.close()



    def init_driver(self):

        """Chrome ?????????? ????????"""

        options = webdriver.ChromeOptions()



        if self.headless:

            options.add_argument('--headless')

            logger.info("[INFO] ??????????? ?????? ???????")



        options.add_argument('--no-sandbox')

        options.add_argument('--disable-dev-shm-usage')

        options.add_argument('--disable-gpu')

        options.add_argument('--window-size=1920,1080')

        options.add_argument('--ignore-certificate-errors')

        options.add_argument('--ignore-ssl-errors')

        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')



        driver = webdriver.Chrome(options=options)

        driver.implicitly_wait(10)

        return driver



    def login(self, driver):

        """UBIKAIS ????????"""

        logger.info("[INFO] UBIKAIS ?????????????...")



        try:

            driver.get(self.login_url)

            time.sleep(2)



            # ????????????

            username_field = WebDriverWait(driver, 10).until(

                EC.presence_of_element_located((By.ID, "userId"))

            )

            username_field.clear()

            username_field.send_keys(self.username)



            # ??????????? ?????

            password_field = driver.find_element(By.ID, "password")

            password_field.clear()

            password_field.send_keys(self.password)



            # General ?????????????

            try:

                general_radio = driver.find_element(By.ID, "login_general")

                if not general_radio.is_selected():

                    driver.execute_script("arguments[0].click();", general_radio)

            except:

                pass



            # ?????????????? ?????

            login_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit'], .btn-login, #loginBtn")

            driver.execute_script("arguments[0].click();", login_btn)



            time.sleep(3)



            # ????????????? ?????

            if "login" not in driver.current_url.lower():

                logger.info("[OK] ?????????????")

                return True

            else:

                logger.error("[ERROR] ????????????? - ???????????????????????")

                return False



        except Exception as e:

            logger.error(f"[ERROR] ?????????????: {e}")

            return False



    def extract_table_data(self, driver, schedule_type='departure'):

        """?????????????????????????????????"""

        schedules = []



        try:

            # ?????????????? ?????

            WebDriverWait(driver, 15).until(

                EC.presence_of_element_located((By.TAG_NAME, "table"))

            )

            time.sleep(2)



            # JavaScript????????????????????????

            extract_script = """

            var result = [];



            // ?????????????? (????? ?????? ?????)

            var tables = document.querySelectorAll('table');

            var dataTable = null;



            for (var i = 0; i < tables.length; i++) {

                var rows = tables[i].querySelectorAll('tbody tr');

                if (rows.length > 0) {

                    dataTable = tables[i];

                    break;

                }

            }



            if (!dataTable) {

                return {error: 'No data table found'};

            }



            var rows = dataTable.querySelectorAll('tbody tr');



            for (var i = 0; i < rows.length; i++) {

                var cells = rows[i].querySelectorAll('td');

                if (cells.length >= 10) {

                    var row = {

                        flight_number: cells[0] ? cells[0].textContent.trim() : '',

                        aircraft_type: cells[1] ? cells[1].textContent.trim() : '',

                        registration: cells[2] ? cells[2].textContent.trim() : '',

                        origin: cells[3] ? cells[3].textContent.trim() : '',

                        std: cells[4] ? cells[4].textContent.trim() : '',

                        etd: cells[5] ? cells[5].textContent.trim() : '',

                        atd: cells[6] ? cells[6].textContent.trim() : '',

                        destination: cells[7] ? cells[7].textContent.trim() : '',

                        sta: cells[8] ? cells[8].textContent.trim() : '',

                        eta: cells[9] ? cells[9].textContent.trim() : '',

                        status: cells[10] ? cells[10].textContent.trim() : '',

                        nature: cells[11] ? cells[11].textContent.trim() : ''

                    };



                    // flight_number??? ????? ????? ?????

                    if (row.flight_number && row.flight_number.length > 0) {

                        result.push(row);

                    }

                }

            }



            return {data: result, count: rows.length};

            """



            extraction_result = driver.execute_script(extract_script)



            if 'error' in extraction_result:

                logger.warning(f"?????????????? ?????: {extraction_result['error']}")

                return schedules



            if 'data' in extraction_result:

                schedules = extraction_result['data']

                logger.info(f"[OK] {len(schedules)}???????????????? (???{extraction_result.get('count', 0)}?????")



                # ????? ??????

                for idx, schedule in enumerate(schedules[:3], 1):

                    logger.debug(f"  {idx}. {schedule.get('flight_number')} - {schedule.get('origin')} -> {schedule.get('destination')}")



        except Exception as e:

            logger.error(f"[ERROR] ????????????????????? ?????: {e}")



        return schedules



    def crawl_departures(self, driver):

        """?????? ???????????????"""

        logger.info("[INFO] ?????? ????????????????????...")



        try:

            driver.get(self.dep_url)

            time.sleep(3)



            # ??????????? ????? (???????

            try:

                search_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], .btn-search, #searchBtn")

                driver.execute_script("arguments[0].click();", search_btn)

                time.sleep(2)

            except:

                pass



            schedules = self.extract_table_data(driver, 'departure')



            for schedule in schedules:

                schedule['schedule_type'] = 'departure'



            return schedules



        except Exception as e:

            logger.error(f"[ERROR] ?????? ????????????????????: {e}")

            return []



    def crawl_arrivals(self, driver):

        """????? ???????????????"""

        logger.info("[INFO] ????? ????????????????????...")



        try:

            driver.get(self.arr_url)

            time.sleep(3)



            # ??????????? ????? (???????

            try:

                search_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], .btn-search, #searchBtn")

                driver.execute_script("arguments[0].click();", search_btn)

                time.sleep(2)

            except:

                pass



            schedules = self.extract_table_data(driver, 'arrival')



            for schedule in schedules:

                schedule['schedule_type'] = 'arrival'



            return schedules



        except Exception as e:

            logger.error(f"[ERROR] ????? ????????????????????: {e}")

            return []



    def save_to_database(self, schedules, crawl_timestamp):

        """???????????????? DB??????"""

        if not schedules:

            return 0



        conn = sqlite3.connect(self.db_name)

        cursor = conn.cursor()

        saved_count = 0



        for schedule in schedules:

            try:

                cursor.execute('''

                    INSERT OR REPLACE INTO flight_schedules

                    (crawl_timestamp, schedule_type, flight_number, aircraft_type,

                     registration, origin, destination, std, etd, atd, sta, eta, status, nature)

                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

                ''', (

                    crawl_timestamp,

                    schedule.get('schedule_type', ''),

                    schedule.get('flight_number', ''),

                    schedule.get('aircraft_type', ''),

                    schedule.get('registration', ''),

                    schedule.get('origin', ''),

                    schedule.get('destination', ''),

                    schedule.get('std', ''),

                    schedule.get('etd', ''),

                    schedule.get('atd', ''),

                    schedule.get('sta', ''),

                    schedule.get('eta', ''),

                    schedule.get('status', ''),

                    schedule.get('nature', '')

                ))

                if cursor.rowcount > 0:

                    saved_count += 1

            except Exception as e:

                logger.warning(f"DB ?????????: {e}")



        conn.commit()

        conn.close()

        return saved_count



    def save_to_json(self, schedules, crawl_timestamp):

        """???????????????? JSON????? ????"""

        data = {

            'crawl_timestamp': crawl_timestamp,

            'last_updated': datetime.now().isoformat(),

            'total_count': len(schedules),

            'schedules': schedules

        }



        with open(self.json_output, 'w', encoding='utf-8') as f:

            json.dump(data, f, ensure_ascii=False, indent=2)



        logger.info(f"[OK] JSON ?????????: {self.json_output}")



    def log_crawl(self, crawl_timestamp, schedule_type, status, records_found,

                  records_saved, error_message=None, execution_time=0):

        """?????????????? ????"""

        conn = sqlite3.connect(self.db_name)

        cursor = conn.cursor()



        cursor.execute('''

            INSERT INTO crawl_logs

            (crawl_timestamp, schedule_type, status, records_found, records_saved,

             error_message, execution_time)

            VALUES (?, ?, ?, ?, ?, ?, ?)

        ''', (crawl_timestamp, schedule_type, status, records_found,

              records_saved, error_message, execution_time))



        conn.commit()

        conn.close()



    def crawl(self):

        """????? ?????????????"""

        driver = None

        start_time = time.time()

        crawl_timestamp = datetime.now().isoformat()

        all_schedules = []



        try:

            logger.info(f"\n{'='*70}")

            logger.info(f"[START] [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] UBIKAIS ?????????????")

            logger.info(f"{'='*70}")



            driver = self.init_driver()



            # ????????

            if not self.login(driver):

                raise Exception("?????????????")



            # ?????? ???????????????

            departures = self.crawl_departures(driver)

            all_schedules.extend(departures)

            logger.info(f"[INFO] ?????? ??????? {len(departures)}???")



            # ????? ???????????????

            arrivals = self.crawl_arrivals(driver)

            all_schedules.extend(arrivals)

            logger.info(f"[INFO] ????? ??????? {len(arrivals)}???")



            # DB ????

            saved_count = self.save_to_database(all_schedules, crawl_timestamp)

            logger.info(f"[INFO] DB ?????????: {saved_count}???")



            # JSON ????

            self.save_to_json(all_schedules, crawl_timestamp)



            execution_time = time.time() - start_time



            # ?????? ????

            self.log_crawl(crawl_timestamp, 'all', 'SUCCESS',

                          len(all_schedules), saved_count, None, execution_time)



            logger.info(f"\n[OK] ????????????? - ???{len(all_schedules)}??? ??????????: {execution_time:.2f}???")



            return {

                'status': 'SUCCESS',

                'departures': len(departures),

                'arrivals': len(arrivals),

                'total': len(all_schedules),

                'saved': saved_count,

                'execution_time': execution_time

            }



        except Exception as e:

            execution_time = time.time() - start_time

            error_msg = str(e)

            logger.error(f"[ERROR] ?????????????: {error_msg}")



            self.log_crawl(crawl_timestamp, 'all', 'FAILED',

                          0, 0, error_msg, execution_time)



            return {

                'status': 'FAILED',

                'error': error_msg,

                'execution_time': execution_time

            }



        finally:

            if driver:

                driver.quit()





def main():

    """?????? ????? ?????"""

    crawler = UBIKAISCrawler(headless=False)  # ??????????????? headless=False

    result = crawler.crawl()



    print("\n" + "="*70)

    print("[SUMMARY] ??????????????")

    print("="*70)



    if result['status'] == 'SUCCESS':

        print(f"  [OK] ?????")

        print(f"  - ?????? ??????? {result['departures']}???")

        print(f"  - ????? ??????? {result['arrivals']}???")

        print(f"  - ??? {result['total']}???(???? {result['saved']}???")

        print(f"  - ??????????: {result['execution_time']:.2f}???")

    else:

        print(f"  [FAIL] ?????: {result['error']}")





if __name__ == "__main__":

    main()

