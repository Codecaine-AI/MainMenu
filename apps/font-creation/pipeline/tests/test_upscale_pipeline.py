from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from gemini_image import build_contents, resolve_image_size, validate_aspect_ratio


def load_script(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


upscale = load_script("upscale_glyphs_script", "02_upscale_glyphs.py")
trace = load_script("trace_fill_paths_script", "03_trace_fill_paths.py")
runner = load_script("run_pipeline_script", "run_pipeline.py")


class PromptTests(unittest.TestCase):
    def test_build_prompt_replaces_user_description(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            prompt = tmp_path / "prompt.md"
            description = tmp_path / "description.md"
            prompt.write_text("before {{USER_DESCRIPTION}} after", encoding="utf-8")
            description.write_text("red metal glyph", encoding="utf-8")

            self.assertEqual(upscale.build_prompt(prompt, description), "before red metal glyph after")


class GeminiImageAdapterTests(unittest.TestCase):
    def test_image_size_resolution_defaults_to_2k(self) -> None:
        self.assertEqual(resolve_image_size("auto", "high"), "2K")
        self.assertEqual(resolve_image_size("default", "low"), "2K")
        self.assertEqual(resolve_image_size("", "high"), "2K")

    def test_explicit_image_sizes_and_dimensions(self) -> None:
        self.assertEqual(resolve_image_size("512", "high"), "512")
        self.assertEqual(resolve_image_size("2048x1024", "high"), "2K")
        self.assertEqual(resolve_image_size("4096x2048", "high"), "4K")

    def test_multi_image_contents_include_prompt_and_images(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            image_a = tmp_path / "a.png"
            image_b = tmp_path / "b.png"
            Image.new("RGB", (4, 5), "white").save(image_a)
            Image.new("RGB", (6, 7), "black").save(image_b)

            contents = build_contents("prompt", [image_a, image_b])

            self.assertEqual(contents[0], "prompt")
            self.assertEqual(contents[1].size, (4, 5))
            self.assertEqual(contents[2].size, (6, 7))

    def test_aspect_ratio_validation(self) -> None:
        self.assertEqual(validate_aspect_ratio("4:5"), "4:5")
        with self.assertRaisesRegex(ValueError, "Unsupported Gemini aspect ratio"):
            validate_aspect_ratio("13:17")

    def test_upscale_aspect_ratio_is_pinned_square(self) -> None:
        self.assertEqual(upscale.DEFAULT_ASPECT_RATIO, "1:1")


class UpscaleRequestTests(unittest.TestCase):
    def test_upscale_sends_only_segmented_crop_image(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            run_dir = tmp_path / "run"
            segment_dir = run_dir / "01_segment"
            crop_dir = segment_dir / "crops"
            crop_dir.mkdir(parents=True)
            crop_path = crop_dir / "A.png"
            Image.new("RGB", (20, 24), (230, 230, 230)).save(crop_path)
            segments_path = segment_dir / "segments.json"
            segments_path.write_text(
                json.dumps({"segments": [{"glyph": "A", "glyph_name": "A", "crop_path": "01_segment/crops/A.png"}]}),
                encoding="utf-8",
            )
            prompt_path = tmp_path / "prompt.md"
            description_path = tmp_path / "description.md"
            prompt_path.write_text("{{USER_DESCRIPTION}}", encoding="utf-8")
            description_path.write_text("description", encoding="utf-8")
            calls: list[list[Path]] = []

            def fake_edit(source_images, prompt, output_path, model, size, quality, aspect_ratio):
                calls.append(list(source_images))
                Image.new("RGB", (64, 64), (230, 230, 230)).save(output_path)
                return output_path

            result = upscale.upscale_glyphs(
                segments_path,
                run_dir / "02_upscale",
                tmp_path / "unused-specimen.png",
                prompt_path,
                description_path,
                image_size="512",
                edit_fn=fake_edit,
                path_base=run_dir,
            )

            self.assertEqual(result["failed_count"], 0)
            self.assertEqual(calls, [[crop_path]])
            request = json.loads((run_dir / "02_upscale" / "upscaled" / "requests" / "A.json").read_text(encoding="utf-8"))
            self.assertEqual(request["input_images"], [str(crop_path)])
            self.assertNotIn("specimen", request)
            self.assertEqual(result["glyphs"][0]["image_path"], "02_upscale/upscaled/images/A.png")
            self.assertEqual(result["glyphs"][0]["image_size"], (64, 64))

    def test_failed_upscale_removes_stale_upscaled_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            run_dir = tmp_path / "run"
            segment_dir = run_dir / "01_segment"
            crop_dir = segment_dir / "crops"
            crop_dir.mkdir(parents=True)
            crop_path = crop_dir / "bar.png"
            Image.new("RGB", (20, 24), (230, 230, 230)).save(crop_path)
            segments_path = segment_dir / "segments.json"
            segments_path.write_text(
                json.dumps({
                    "segments": [{
                        "glyph": "|",
                        "glyph_name": "bar",
                        "crop_path": "01_segment/crops/bar.png",
                        "upscaled_crop_path": "02_upscale/upscaled/images/bar.png",
                    }]
                }),
                encoding="utf-8",
            )
            prompt_path = tmp_path / "prompt.md"
            description_path = tmp_path / "description.md"
            prompt_path.write_text("{{USER_DESCRIPTION}}", encoding="utf-8")
            description_path.write_text("description", encoding="utf-8")

            def fake_edit(*args, **kwargs):
                raise RuntimeError("image provider rejected request")

            result = upscale.upscale_glyphs(
                segments_path,
                run_dir / "02_upscale",
                tmp_path / "unused-specimen.png",
                prompt_path,
                description_path,
                image_size="512",
                edit_fn=fake_edit,
                path_base=run_dir,
            )

            updated_segments = json.loads(segments_path.read_text(encoding="utf-8"))
            self.assertEqual(result["failed_count"], 1)
            self.assertNotIn("upscaled_crop_path", updated_segments["segments"][0])


class TraceInputSelectionTests(unittest.TestCase):
    def test_requires_upscaled_path_when_requested(self) -> None:
        with self.assertRaisesRegex(ValueError, "Missing upscaled_crop_path"):
            trace.select_trace_input_key({"glyph_name": "A", "crop_path": "crops/A.png"}, require_upscaled=True)

    def test_falls_back_to_original_when_not_required(self) -> None:
        self.assertEqual(
            trace.select_trace_input_key({"crop_path": "crops/A.png"}, require_upscaled=False),
            "crop_path",
        )

    def test_prefers_upscaled_path(self) -> None:
        self.assertEqual(
            trace.select_trace_input_key(
                {"crop_path": "crops/A.png", "upscaled_crop_path": "upscaled/images/A.png"},
                require_upscaled=True,
            ),
            "upscaled_crop_path",
        )

    def test_ignores_stale_normalized_mask_path(self) -> None:
        self.assertEqual(
            trace.select_trace_input_key(
                {
                    "crop_path": "crops/A.png",
                    "upscaled_crop_path": "upscaled/images/A.png",
                    "normalized_mask_path": "normalized/masks/A.png",
                },
                require_upscaled=True,
            ),
            "upscaled_crop_path",
        )


class RunPipelineTests(unittest.TestCase):
    def test_selected_steps_respects_range_and_disabled_optional_steps(self) -> None:
        self.assertEqual(
            runner.selected_steps("trace", "svgs", upscale_enabled=True, render_text="CODECAINE"),
            ["trace", "svgs"],
        )
        self.assertEqual(
            runner.selected_steps(None, None, upscale_enabled=False, render_text=None),
            ["segment", "trace", "svgs"],
        )
        self.assertNotIn("normalize", runner.STEP_ORDER)

    def test_create_run_snapshots_inputs_and_writes_latest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for path, content in {
                "sheet.jpeg": "image",
                "description.md": "description",
                "glyph-map.json": "{}",
                "style.json": "{}",
                "prompt.md": "{{USER_DESCRIPTION}}",
            }.items():
                (root / path).write_text(content, encoding="utf-8")

            spec_path = root / "run.json"
            spec_path.write_text(
                """{
  "name": "sample",
  "image": "sheet.jpeg",
  "description": "description.md",
  "glyph_map": "glyph-map.json",
  "style": "style.json",
  "prompt": "prompt.md",
  "render_text": "TEST",
  "tracking": null,
  "upscale": {"enabled": false}
}""",
                encoding="utf-8",
            )
            args = Namespace(
                run_spec=str(spec_path),
                out="output",
                no_upscale=True,
                image=None,
                description=None,
                glyph_map=None,
                style=None,
                prompt=None,
                render_text=None,
                tracking=None,
                image_model=None,
                image_size=None,
                image_quality=None,
                max_workers=None,
            )

            run_dir, spec = runner.create_run(args, root)

            self.assertTrue((run_dir / "inputs" / "alphabet-sheet.jpeg").exists())
            self.assertTrue((run_dir / "run.json").exists())
            self.assertTrue((run_dir / "status.json").exists())
            self.assertEqual((root / "output" / "runs" / "latest.txt").read_text(encoding="utf-8").strip(), str(run_dir))
            self.assertEqual(spec["image"], "inputs/alphabet-sheet.jpeg")
            self.assertFalse(spec["upscale"]["enabled"])


if __name__ == "__main__":
    unittest.main()
