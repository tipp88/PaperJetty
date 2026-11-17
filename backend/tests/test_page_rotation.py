import base64
import io
import unittest
from unittest.mock import AsyncMock, patch

from PIL import Image
from PyPDF2 import PdfReader
from pydantic import ValidationError

from app.routers.pdf import PDFGenerateRequest, generate_pdf
from app.routers.paperless import PaperlessUploadRequest, upload_document
from app.services.pdf_service import generate_pdf_from_images


def sample_image():
    # Distinct quadrants expose clockwise/counterclockwise errors, not just size.
    image = Image.new('RGB', (80, 120))
    image.paste((255, 0, 0), (0, 0, 40, 60))
    image.paste((0, 255, 0), (40, 0, 80, 60))
    image.paste((0, 0, 255), (0, 60, 40, 120))
    image.paste((255, 255, 0), (40, 60, 80, 120))
    buffer = io.BytesIO()
    image.save(buffer, 'PNG')
    return base64.b64encode(buffer.getvalue()).decode()


class PageRotationTests(unittest.IsolatedAsyncioTestCase):
    async def test_pdf_pixels_match_clockwise_rotation_and_page_order(self):
        rotations = [0, 90, 180, 270]
        pdf = await generate_pdf_from_images(
            [sample_image()] * 4, rotations=rotations, compression_quality=100,
        )
        pages = PdfReader(io.BytesIO(pdf)).pages
        self.assertEqual(len(pages), 4)
        # Top-left quadrant after each clockwise rotation.
        colors = [(255, 0, 0), (0, 0, 255), (255, 255, 0), (0, 255, 0)]
        for page, rotation, expected_color in zip(pages, rotations, colors):
            objects = page['/Resources']['/XObject'].get_object()
            embedded = next(iter(objects.values())).get_object()
            image = Image.open(io.BytesIO(embedded.get_data()))
            self.assertEqual(image.size, (120, 80) if rotation in (90, 270) else (80, 120))
            actual = image.getpixel((10, 10))
            self.assertTrue(all(abs(a - b) < 10 for a, b in zip(actual, expected_color)))

    async def test_old_clients_can_omit_rotation(self):
        pdf = await generate_pdf_from_images([sample_image()])
        self.assertEqual(len(PdfReader(io.BytesIO(pdf)).pages), 1)
        self.assertIsNone(PDFGenerateRequest(images=[sample_image()]).rotations)

    async def test_both_routes_forward_rotation_to_pdf_generator(self):
        for module, model, handler in [
            ('app.routers.pdf', PDFGenerateRequest, generate_pdf),
            ('app.routers.paperless', PaperlessUploadRequest, upload_document),
        ]:
            request = model(images=[sample_image()], rotations=[90], title='Rotated')
            with patch(f'{module}.generate_pdf_from_images', new_callable=AsyncMock) as generator:
                generator.return_value = b'%PDF-test'
                with patch('app.routers.paperless.upload_to_paperless', new_callable=AsyncMock) as upload:
                    upload.return_value = {'id': 1}
                    await handler(request)
                self.assertEqual(generator.call_args.kwargs['rotations'], [90])

    async def test_invalid_rotation_or_length_rejected(self):
        for model in (PDFGenerateRequest, PaperlessUploadRequest):
            for rotations in ([45], [], [0, 90]):
                with self.assertRaises(ValidationError):
                    model(images=[sample_image()], rotations=rotations, title='Invalid')
        with self.assertRaises(ValueError):
            await generate_pdf_from_images([sample_image()], rotations=[])


if __name__ == '__main__':
    unittest.main()
