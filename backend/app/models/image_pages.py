from typing import Literal
from pydantic import BaseModel, model_validator


class ImagePagesRequest(BaseModel):
    images: list[str]
    # Optional for older clients; positive angles match CSS clockwise rotation.
    rotations: list[Literal[0, 90, 180, 270]] | None = None

    @model_validator(mode="after")
    def validate_rotations(self):
        if self.rotations is not None and len(self.rotations) != len(self.images):
            raise ValueError("Provide one rotation per image")
        return self
