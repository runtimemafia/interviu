# Interviu


Go into server folder

```
cd server
```

Make new virtual environment

```
python -m venv .venv
```

Install dependencies

```
pip install -r requirements.txt
```

Make env file from the example file 

```
cp .env.example .env
```

Run migrations

```
python db/migrate.py
```

Run server


```
fastapi dev main.py
```