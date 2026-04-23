from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from PIL import Image

from melee_pipeline.model_adapters.gemini_image import resolve_image_size
from melee_pipeline.pipeline.asset_generation.steps.critique import build_critique_prompt
from melee_pipeline.pipeline.asset_generation.steps.generate import build_generation_prompt
from melee_pipeline.pipeline.extraction.extract import normalize_extracted_file
from melee_pipeline.schemas import (
    AssetEntry,
    AssetType,
    ImageSize,
    ImplementationMode,
    ZOrder,
)


class GeminiImageSizingTests(unittest.TestCase):
    def test_auto_and_default_resolve_to_1k(self) -> None:
        self.assertEqual(resolve_image_size("auto", "high"), "1K")
        self.assertEqual(resolve_image_size("default", "ultra"), "1K")
        self.assertEqual(resolve_image_size("", "low"), "1K")

    def test_explicit_sizes_still_win(self) -> None:
        self.assertEqual(resolve_image_size("512", "high"), "512")
        self.assertEqual(resolve_image_size("2048x1024", "high"), "2K")


class ExtractionNormalizationTests(unittest.TestCase):
    def test_normalize_extracted_file_preserves_raw_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            asset_dir = Path(tmp_dir)
            output_path = asset_dir / "extracted.png"
            Image.new("RGBA", (1600, 900), (255, 0, 0, 255)).save(output_path)

            artifacts = normalize_extracted_file(
                output_path,
                output_path,
                target_size=ImageSize(width=361, height=219),
                asset_dir=asset_dir,
            )

            self.assertEqual(artifacts.raw_output_path, (asset_dir / "raw-extracted.png").resolve())
            self.assertEqual(artifacts.raw_size, ImageSize(width=1600, height=900))
            self.assertEqual(artifacts.normalized_size, ImageSize(width=361, height=219))

            with Image.open(artifacts.raw_output_path) as raw_image:
                self.assertEqual(raw_image.size, (1600, 900))

            with Image.open(artifacts.output_path).convert("RGBA") as normalized_image:
                self.assertEqual(normalized_image.size, (361, 219))
                self.assertEqual(normalized_image.getchannel("A").getbbox(), (0, 8, 361, 211))


class ComponentPromptTests(unittest.TestCase):
    def test_generation_prompt_includes_exact_target_size(self) -> None:
        asset = AssetEntry(
            id="asset_test",
            name="frame",
            type=AssetType.FRAME,
            visual_description="A glowing menu frame.",
            location="center",
            bounds="approximate [0, 0, 361, 219]",
            z_order=ZOrder.FRONT,
            extraction_hint="Keep only the frame.",
        )

        prompt = build_generation_prompt(
            prompt_template="template",
            asset=asset,
            implementation_mode=ImplementationMode.CSS_SVG_HYBRID,
            iteration=1,
            previous_report=None,
            target_size=ImageSize(width=361, height=219),
        )

        self.assertIn("361px by 219px", prompt)
        self.assertIn("Reference image size: 361x219", prompt)
        self.assertIn("faithful reconstruction brief", prompt)

    def test_critique_prompt_describes_two_image_comparison(self) -> None:
        asset = AssetEntry(
            id="asset_test",
            name="frame",
            type=AssetType.FRAME,
            visual_description="A glowing menu frame.",
            location="center",
            bounds="approximate [0, 0, 361, 219]",
            z_order=ZOrder.FRONT,
            extraction_hint="Keep only the frame.",
        )
        prompt = build_critique_prompt(
            prompt_template="template",
            asset=asset,
            iteration=2,
            threshold=0.95,
        )

        self.assertIn("Two images are attached in this order", prompt)
        self.assertNotIn("diff metrics", prompt.lower())

if __name__ == "__main__":
    unittest.main()
