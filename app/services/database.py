import sqlite3
from contextlib import contextmanager

DB_PATH = "database/asymptote.db"
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn #hand connection to endpoint
        conn.commit() #when it comes back it means everything worked so it commits the change
    except:
        conn.rollback()#if something in the endpoint goes wrong it rolls back the changes so a partial change isnt saved
        raise
    finally:
        conn.close()#always close connection to free up resources