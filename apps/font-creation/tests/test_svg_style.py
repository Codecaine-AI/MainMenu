from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from common import glyph_svg, word_svg


GLYPH_RECORD = {
    "glyph": "A",
    "glyph_name": "A",
    "advance_width": 1000,
    "units_per_em": 1000,
    "path_d": "M 100 900 L 500 100 L 900 900 Z",
    "fill_rule": "evenodd",
}


STYLE = {
    "svg_style": {
        "fill_color": "#8b0000",
        "fill_gradient": [
            {"offset": "0%", "color": "#d21414"},
            {"offset": "100%", "color": "#4d0000"},
        ],
        "silver_gradient": [
            {"offset": "0%", "color": "#ffffff"},
            {"offset": "100%", "color": "#1e252a"},
        ],
        "red_gloss": {"opacity": 0.38, "height_ratio": 0.42},
        "rim_glow": {"stroke_color": "#ffffff", "stroke_width": 82},
        "edge_shadow": {"stroke_color": "#050505", "stroke_width": 82},
        "edge_highlight": {"stroke_color": "#ffffff", "stroke_width": 22},
    },
    "metrics": {"units_per_em": 1000},
}


class SvgStyleTests(unittest.TestCase):
    def test_glyph_svg_includes_shiny_layer_stack(self) -> None:
        svg = glyph_svg(GLYPH_RECORD, STYLE)

        self.assertIn('id="red-fill-gradient"', svg)
        self.assertIn('id="red-gloss-layer"', svg)
        self.assertIn('id="rim-glow-layer"', svg)
        self.assertIn('id="edge-highlight-layer"', svg)

    def test_word_svg_includes_shiny_layer_stack(self) -> None:
        svg = word_svg("A", {"A": GLYPH_RECORD}, STYLE)

        self.assertIn('id="red-fill-gradient"', svg)
        self.assertIn('id="red-gloss-layer"', svg)
        self.assertIn('id="rim-glow-layer"', svg)
        self.assertIn('id="edge-highlight-layer"', svg)


if __name__ == "__main__":
    unittest.main()
