## Car Service Overview

The **Car Service** is designed for:

- **CRUD operations** for cars (test/demo only, not the main focus)
- **Integration with external car data APIs** (e.g., [CarQuery API](https://www.carqueryapi.com/api/0.3/?cmd=getTrims&model=camry)) to prepare data for select inputs and filters
- **Efficient search and filtering** of cars using open data sources
- **Caching frequent queries** (using Redis or edge caching) to improve performance

### Example API Routes

```http
GET /brands                # Get all car brands
GET /brands/:id/models     # Get models for a brand
GET /models/:id/variants   # Get variants for a model
GET /variants/:id/specs    # Get technical specs for a variant
```

These endpoints are used to power car search and filtering in the admin panel, leveraging open automotive data.

> **Note:**  
> CRUD operations for cars are currently implemented for testing/demo purposes only and are not the main focus of this service.

---

### Data Sources

- Uses [CarQuery API](https://www.carqueryapi.com/) and similar open APIs to fetch up-to-date car data for selects and filters.

### Caching

- Frequently requested data (e.g., brands, models, variants) is cached using Redis or edge caching to reduce latency and external API calls.

---

**This service is essential for enabling rich, fast, and up-to-date car search/filtering in your admin panel.**
