"""Compatibility package exposing the backend modules under the ``app`` name.

This allows existing imports such as ``import app.database`` to continue
working even though the source lives under ``server/app`` in this
repository layout.
"""

from importlib import import_module
import sys

_backend = import_module("server.app")
sys.modules[__name__] = _backend
