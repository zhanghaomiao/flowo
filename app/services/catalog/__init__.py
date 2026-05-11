"""Catalog services package.

Import ``CatalogService`` from ``app.services.catalog.service`` directly. Keeping
this package initializer lightweight avoids circular imports when lower-level
helpers are imported by DAG generation code.
"""
