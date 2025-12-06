import csv
import random
import re

import requests
from bs4 import BeautifulSoup

def trim_alnum(text):
    text = re.sub(r'^[^a-zA-Z0-9"ĄĘĆŻŹÓŁ]+', '', text)
    text = re.sub(r'[^a-zA-Z0-9"ĄĘĆŻŹÓŁ]+$', '', text)
    return text

def trim_quotes(text):
    if text.startswith('"') and text.endswith('"'):
        text = text[1:-1]
    return text

def trim(text):
    return trim_alnum(
                trim_quotes(text))


class StatueReader:
    """
    Klasa StatueReader odpowiada za odczyt danych o pomnikach bydgoskich ze strony internetowej,
    zapis tych danych do pliku
    oraz ich wyświetlenie do konsoli.
    """

    def __init__(self, url):
        self.url = url
        self.statues = None

    def get_statues_from_site(self):
        """
        Metoda przygotowuje słownik zawierający:
        nazwę ["name"],
        lokalizację ["location"],
        link do strony z opisem ["link"] oraz
        link do zdjęcia ["image"].
        Źródłem jest link podany przy tworzeniu obiektu klasy StatueReader.
        """
        counter = 1

        response = requests.get(self.url)
        soup = BeautifulSoup(response.text, 'html.parser')

        self.statues = []

        items = soup.find_all('li', class_='col-md-4')

        for item in items:
            # link i image
            a_tag = item.find('figure').find('a')
            link = "https://visitbydgoszcz.pl" + a_tag['href']
            img_url = a_tag.find('img')['src']

            # id pomnika
            id = counter
            counter += 1

            # nazwa pomnika
            name = item.find('h3').get_text(strip=True)

            # lokalizacja
            location_tag = item.find('div', class_='txt-1')
            location = location_tag.get_text(strip=True) if location_tag else None

            # trim name i location
            name = trim(name)
            location = trim(location)

            # dodanie do słownika
            self.statues.append({
                "id": id,
                "name": name,
                "location": location,
                "link": link,
                "image": img_url,
            })


    def saveCSV(self, filename):
        """
        Metoda zapisuje dane pobrane metodą get_statues_from_site do pliku csv zadanego ścieżką filename wraz z ewentualnymi opisami.
        """
        headers = list(self.statues[0].keys())

        with open(filename, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile, delimiter=';')
            writer.writerow(headers)

            for item in self.statues:
                row = []
                for h in headers:
                    # if h == "description":
                    #     # przypisujemy opis z dict lub pusty string jeśli brak
                    #     row.append(descriptions.get(item.get("name", ""), ""))
                    # else:
                    row.append(item.get(h, ""))
                writer.writerow(row)


    def display_statues(self, filename):
        """
        Wyświetlanie podstawowych danych o pomnikach
        :param filename:
        :return:
        """
        print("id; name; location")
        with open(filename, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile, delimiter=';')
            for item in reader:
                print(item["id"], ";", item["name"], ";", item["location"])

    def display_statues_names(self, filename):
        """
        Funkcja pomocnicza do tworzenia przykładowych pytań
        :param filename: nazwa pliku
        :return: -
        """
        questionid = 1
        answers = [{'poprawna':True},
                   {'niepop1':False},
                   {'niepop2':False}
                ]

        # do kazdego pomnika 2 pytania
        num_of_quests = 2
        with open(filename, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile, delimiter=';')
            for item in reader:
                for i in range(num_of_quests):
                    random.shuffle(answers)

                    correct_index = next(
                        i for i, d in enumerate(answers)
                        if True in d.values()
                    )

                    if correct_index == 0:
                        correct_index = 'A'
                    elif correct_index == 1:
                        correct_index = 'B'
                    elif correct_index == 2:
                        correct_index = 'C'

                    print(f"{item["name"]};question number {questionid};{list(answers[0].keys())[0]};{list(answers[1].keys())[0]};{list(answers[2].keys())[0]};{correct_index}")
                    questionid += 1


url = "https://visitbydgoszcz.pl/pl/miejsca/87-rzezby-i-pomniki"
sr = StatueReader(url)
# sr.get_statues_from_site()
# sr.saveCSV("pomniki.csv")
#sr.display_statues("pomniki.csv")

sr.display_statues_names("pomniki.csv")