from sqlalchemy.orm import Session


class SearchService:
    def __init__(self, db_session: Session) -> None:
        self.db_session = db_session

    def workflows(
        self,
        limit,
        tags,
        name,
    ):
        pass

    def jobs():
        pass
