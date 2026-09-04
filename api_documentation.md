# HR Performance Backend API Reference & Schema Documentation

This document describes all MongoDB database schemas, request/response payloads, authentication mechanisms, and API endpoints defined in the HR Performance backend.

> [!NOTE]
> **Payload Support**: All API endpoints support incoming payloads as **JSON** (`application/json`), standard **URL-encoded form data** (`application/x-www-form-urlencoded`), or **Multipart Form Data** (`multipart/form-data`) via `multer`.

---

## 1. Database Schemas (MongoDB)

All schemas are constructed using **Mongoose** and include automatic MongoDB `_id` generation.

### User Schema

- **File Path**: `./models/User.js`
- **Description**: Represents HR team members and Superadmins who use the system.

| Field Name  | Type       | Constraints / Validators                          | Default | Description                    |
| :---------- | :--------- | :------------------------------------------------ | :------ | :----------------------------- |
| `name`      | `String`   | Required                                          | -       | The user's full name.          |
| `email`     | `String`   | Required, Unique                                  | -       | Unique login email.            |
| `password`  | `String`   | Required                                          | -       | BCRYPT hashed password string. |
| `role`      | `String`   | Enum: `["superadmin", "hr"]`                      | `"hr"`  | Defines user level privileges. |
| `projects`  | `[String]` | Enum: `["Talent Corner", "Recruitment Tracking"]` | `[]`    | Projects assigned to the user. |
| `createdAt` | `Date`     | Generated automatically by `timestamps`           | -       | Record creation timestamp.     |
| `updatedAt` | `Date`     | Generated automatically by `timestamps`           | -       | Record modification timestamp. |

---

### Recruitment Schema

- **File Path**: `./models/Recruitment.js`
- **Description**: Stores candidate tracking records under the "Recruitment Tracking" project.

| Field Name          | Type       | Constraints / Validators                                                            | Description                                     |
| :------------------ | :--------- | :---------------------------------------------------------------------------------- | :---------------------------------------------- |
| `hrId`              | `ObjectId` | Required, References `User` model                                                   | The HR user who created/owns this record.       |
| `candidateName`     | `String`   | Required                                                                            | Candidate's full name.                          |
| `candidateContact`  | `String`   | Required                                                                            | Contact phone number or email of the candidate. |
| `candidateLocation` | `String`   | Required                                                                            | Candidate's home city or region.                |
| `disposition`       | `String`   | Required, Enum: `["Interested/Maybe", "Not Interested", "Call Back", "No Contact"]` | Call/outreach disposition state.                |
| `createdAt`         | `Date`     | Generated automatically by `timestamps`                                             | Record creation timestamp.                      |
| `updatedAt`         | `Date`     | Generated automatically by `timestamps`                                             | Record modification timestamp.                  |

---

### TalentCorner Schema

- **File Path**: `./models/TalentCorner.js`
- **Description**: Stores candidate profiles tracking CV status under the "Talent Corner" project.

| Field Name             | Type       | Constraints / Validators                             | Description                               |
| :--------------------- | :--------- | :--------------------------------------------------- | :---------------------------------------- |
| `hrId`                 | `ObjectId` | Required, References `User` model                    | The HR user who created/owns this record. |
| `candidateName`        | `String`   | Required                                             | Candidate's full name.                    |
| `candidatePhone`       | `String`   | Required                                             | Contact telephone number.                 |
| `candidateLocation`    | `String`   | Required                                             | Candidate's home location.                |
| `candidateDesignation` | `String`   | Required                                             | Candidate's targeted job title.           |
| `status`               | `String`   | Required, Enum: `["Resume Sent", "Resume Not Sent"]` | Status of the candidate's CV submission.  |
| `createdAt`            | `Date`     | Generated automatically by `timestamps`              | Record creation timestamp.                |
| `updatedAt`            | `Date`     | Generated automatically by `timestamps`              | Record modification timestamp.            |

---

### Designation Schema

- **File Path**: `./models/Designation.js`
- **Description**: Stores designations mapped to specific projects (forms).

| Field Name  | Type       | Constraints / Validators                       | Description                                       |
| :---------- | :--------- | :--------------------------------------------- | :------------------------------------------------ |
| `name`      | `String`   | Required, Unique, Trimmed                      | The name of the designation.                      |
| `project`   | `[String]` | Required, Enum: `["Silgate", "Talent Corner"]` | Array of projects where this designation applies. |
| `createdBy` | `ObjectId` | Required, References `User` model              | The user who created the designation.             |
| `createdAt` | `Date`     | Generated automatically by `timestamps`        | Record creation timestamp.                        |
| `updatedAt` | `Date`     | Generated automatically by `timestamps`        | Record modification timestamp.                    |

---

## 2. Authentication & Authorization Middleware

### Authentication: `authMiddleware`

- **File Path**: `./middleware/authMiddleware.js`
- **Expects Header**: `Authorization: Bearer <JWT_TOKEN>`
- **Behavior**: Extracts the JWT token, verifies it against `process.env.JWT_SECRET`, decodes payload fields (`id`, `role`, etc.), and populates `req.user`. Returns `401 Unauthorized` if token is missing or invalid.

### Authorization: `checkRole(...roles)`

- **File Path**: `./middleware/roleMiddleware.js`
- **Expects**: Must be placed _after_ `authMiddleware`.
- **Behavior**: Checks if `req.user.role` matches any of the permitted roles (e.g., `"superadmin"`). Returns `403 Forbidden` if role is unauthorized.

---

## 3. API Endpoints

### 3.1 Authentication Route (`/api/auth`)

- **Route Base File**: `./routes/authRoutes.js`
- **Controller File**: `./contollers/authController.js`

#### 3.1.1 Register User

- **Method**: `POST`
- **Route**: `/api/auth/register`
- **Authentication**: None (Public)
- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword",
    "role": "hr",
    "projects": ["Talent Corner"]
  }
  ```
- **Validations**:
  - Checks if user with the same email already exists (returns `400`).
- **Response (201 Created)**:
  ```json
  {
    "message": "User created successfully",
    "user": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "hr",
      "projects": ["Talent Corner"],
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### 3.1.2 Login User

- **Method**: `POST`
- **Route**: `/api/auth/login`
- **Authentication**: None (Public)
- **Request Body**:
  ```json
  {
    "username": "john@example.com",
    "password": "securepassword"
  }
  ```
- **Validations**:
  - `username` (or `email`): Required. Checked against user emails.
  - `password`: Required. Verified against the bcrypt hashed password in the database.
- **Response (200 OK)**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1...",
    "user": {
      "name": "John Doe",
      "role": "hr",
      "projects": ["Talent Corner"]
    }
  }
  ```

---

### 3.2 User Management Routes (`/api/users`)

- **Route Base File**: `./routes/userRoutes.js`
- **Controller File**: `./contollers/userController.js`
- **Requirement**: All user routes require **Superadmin** authorization (`authMiddleware` + `checkRole("superadmin")`).

#### 3.2.1 Create HR User

- **Method**: `POST`
- **Route**: `/api/users/createHR`
- **Headers**: `Authorization: Bearer <Token>`
- **Request Body**:
  ```json
  {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "mypassword123",
    "projects": ["Talent Corner", "Recruitment Tracking"]
  }
  ```
- **Validations**:
  - `name`: Must be a non-empty string.
  - `email`: Must be a valid email format. Cannot duplicate existing email.
  - `password`: Must be a string of at least 6 characters.
  - `projects`: If provided, must be an array containing only `"Talent Corner"` or `"Recruitment Tracking"`.
- **Response (201 Created)**:
  ```json
  {
    "message": "HR user created successfully.",
    "user": {
      "_id": "...",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "hr",
      "projects": ["Talent Corner", "Recruitment Tracking"],
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### 3.2.2 Get All HR Users

- **Method**: `GET`
- **Route**: `/api/users/allHR`
- **Headers**: `Authorization: Bearer <Token>`
- **Response (200 OK)**:
  ```json
  [
    {
      "_id": "...",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "hr",
      "projects": ["Talent Corner"],
      "createdAt": "..."
    }
  ]
  ```

#### 3.2.3 Update HR User's Project Assignments

- **Method**: `PATCH`
- **Route**: `/api/users/updateProject/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Request Params**: `id` (The database `_id` of the target HR user)
- **Request Body**:
  ```json
  {
    "projects": ["Recruitment Tracking"]
  }
  ```
- **Validations**:
  - `projects`: Required. Must be an array containing valid project names (`"Talent Corner"`, `"Recruitment Tracking"`).
  - Target user must exist and have the role `"hr"`.
- **Response (200 OK)**:
  ```json
  {
    "message": "HR user projects updated successfully.",
    "user": {
      "_id": "...",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "hr",
      "projects": ["Recruitment Tracking"],
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### 3.2.4 Delete HR User

- **Method**: `DELETE`
- **Route**: `/api/users/delete/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Request Params**: `id` (The database `_id` of the target user)
- **Validations**:
  - Superadmin users cannot be deleted (returns `400`).
- **Response (200 OK)**:
  ```json
  {
    "message": "HR user deleted successfully. Associated talent and recruitment records remain intact."
  }
  ```

---

### 3.3 Recruitment Tracking Routes (`/api/recruitment`)

- **Route Base File**: `./routes/recruitmentRoutes.js`
- **Controller File**: `./contollers/recruitmentController.js`

#### 3.3.1 Add Recruitment Record

- **Method**: `POST`
- **Route**: `/api/recruitment/add`
- **Headers**: `Authorization: Bearer <Token>`
- **Authorization Rule**: User must be authenticated. If they are `"hr"`, they must be assigned to the `"Recruitment Tracking"` project.
- **Request Body**:
  ```json
  {
    "candidateName": "Bruce Wayne",
    "candidateContact": "+1-555-0199",
    "candidateLocation": "Gotham City",
    "disposition": "Interested/Maybe"
  }
  ```
- **Validations**:
  - `candidateName`: Required, non-empty string.
  - `candidateContact`: Required, non-empty string.
  - `candidateLocation`: Required, non-empty string.
  - `disposition`: Required. Must be one of: `'Interested/Maybe'`, `'Not Interested'`, `'Call Back'`, `'No Contact'`.
- **Response (201 Created)**:
  ```json
  {
    "message": "Candidate added to Recruitment Tracking successfully.",
    "recruitment": {
      "_id": "...",
      "hrId": "...",
      "candidateName": "Bruce Wayne",
      "candidateContact": "+1-555-0199",
      "candidateLocation": "Gotham City",
      "disposition": "Interested/Maybe",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### 3.3.2 View My Recruitment Records

- **Method**: `GET`
- **Route**: `/api/recruitment/myData`
- **Headers**: `Authorization: Bearer <Token>`
- **Description**: Returns all records matching the logged-in user's `hrId`, sorted by creation date descending. Populates creator user fields.
- **Response (200 OK)**:
  ```json
  [
    {
      "_id": "...",
      "hrId": {
        "_id": "...",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "role": "hr",
        "projects": ["Recruitment Tracking"]
      },
      "candidateName": "Bruce Wayne",
      "candidateContact": "+1-555-0199",
      "candidateLocation": "Gotham City",
      "disposition": "Interested/Maybe",
      "createdAt": "..."
    }
  ]
  ```

#### 3.3.3 View All Recruitment Records

- **Method**: `GET`
- **Route**: `/api/recruitment/allData`
- **Headers**: `Authorization: Bearer <Token>`
- **Authorization Rule**: **Superadmin only**.
- **Response (200 OK)**:
  - List of all recruitment tracking entries in the database, with creator HR user details populated.

#### 3.3.4 Update Recruitment Record

- **Method**: `PATCH`
- **Route**: `/api/recruitment/update/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Request Params**: `id` (The recruitment record database `_id`)
- **Request Body** _(all fields optional)_:
  ```json
  {
    "candidateName": "Bruce Wayne Updated",
    "disposition": "Call Back"
  }
  ```
- **Authorization & Validation Rules**:
  - Superadmin can update any record.
  - HR users can only update their own records and must still be assigned to `"Recruitment Tracking"`.
  - Body validations apply for any field provided.
- **Response (200 OK)**:
  ```json
  {
    "message": "Recruitment record updated successfully.",
    "recruitment": {
      "_id": "...",
      "hrId": {
        "_id": "...",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "candidateName": "Bruce Wayne Updated",
      "candidateContact": "+1-555-0199",
      "candidateLocation": "Gotham City",
      "disposition": "Call Back",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

---

### 3.4 Talent Corner Routes (`/api/talent`)

- **Route Base File**: `./routes/talentRoutes.js`
- **Controller File**: `./contollers/talentController.js`

#### 3.4.1 Add Talent Record

- **Method**: `POST`
- **Route**: `/api/talent/add`
- **Headers**: `Authorization: Bearer <Token>`
- **Authorization Rule**: User must be authenticated. If they are `"hr"`, they must be assigned to the `"Talent Corner"` project.
- **Request Body**:
  ```json
  {
    "candidateName": "Clark Kent",
    "candidatePhone": "+1-555-0144",
    "candidateLocation": "Metropolis",
    "candidateDesignation": "Senior Journalist",
    "status": "Resume Sent"
  }
  ```
- **Validations**:
  - `candidateName`: Required, non-empty string.
  - `candidatePhone`: Required, non-empty string.
  - `candidateLocation`: Required, non-empty string.
  - `candidateDesignation`: Required, non-empty string.
  - `status`: Required. Must be one of: `'Resume Sent'`, `'Resume Not Sent'`.
- **Response (201 Created)**:
  ```json
  {
    "message": "Candidate added to Talent Corner successfully.",
    "talent": {
      "_id": "...",
      "hrId": "...",
      "candidateName": "Clark Kent",
      "candidatePhone": "+1-555-0144",
      "candidateLocation": "Metropolis",
      "candidateDesignation": "Senior Journalist",
      "status": "Resume Sent",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### 3.4.2 View My Talent Records

- **Method**: `GET`
- **Route**: `/api/talent/myData`
- **Headers**: `Authorization: Bearer <Token>`
- **Description**: Returns all records matching the logged-in user's `hrId`, sorted by creation date descending. Populates creator user fields.
- **Response (200 OK)**:
  - List of the caller's talent entries.

#### 3.4.3 View All Talent Records

- **Method**: `GET`
- **Route**: `/api/talent/allData`
- **Headers**: `Authorization: Bearer <Token>`
- **Authorization Rule**: **Superadmin only**.
- **Response (200 OK)**:
  - List of all talent entries in the database, with creator HR user details populated.

#### 3.4.4 Update Talent Record

- **Method**: `PATCH`
- **Route**: `/api/talent/update/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Request Params**: `id` (The talent record database `_id`)
- **Request Body** _(all fields optional)_:
  ```json
  {
    "candidateName": "Clark Kent Updated",
    "status": "Resume Not Sent"
  }
  ```
- **Authorization & Validation Rules**:
  - Superadmin can update any record.
  - HR users can only update their own records and must still be assigned to `"Talent Corner"`.
  - Body validations apply for any field provided.
- **Response (200 OK)**:
  ```json
  {
    "message": "Talent Corner record updated successfully.",
    "talent": {
      "_id": "...",
      "hrId": {
        "_id": "...",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "candidateName": "Clark Kent Updated",
      "candidatePhone": "+1-555-0144",
      "candidateLocation": "Metropolis",
      "candidateDesignation": "Senior Journalist",
      "status": "Resume Not Sent",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

---

### 3.5 Dashboard Stats Route (`/api/dashboard`)

- **Route Base File**: `./routes/dashboardRoutes.js`
- **Controller File**: `./contollers/dashboardController.js`

#### 3.5.1 Get Dashboard Statistics

- **Method**: `GET`
- **Route**: `/api/dashboard/stats`
- **Headers**: `Authorization: Bearer <Token>`
- **Query Parameters**:
  - `hrId`: Filter by a specific HR user ID (or `"all"` for all HRs).
  - `projectId`: Filter by project ID (`"silgate"`, `"talent_corner"`, or `"null"` for both).
- **Response (200 OK)**:
  Returns dashboard KPIs, weekly/monthly submission trends, filter options, and progressive report summaries.
  ```json
  {
    "type": "default_overview",
    "stats": {
      "totalProjects": 2,
      "totalSubmissions": 100,
      "totalHRs": 2,
      "totalForms": 2
    },
    "filters": {
      "hrs": [
        { "_id": "...", "name": "Pooja Gaikwad", "ecn": "12345" }
      ],
      "projects": [
        { "_id": "silgate", "name": "Silgate" },
        { "_id": "talent_corner", "name": "Talent Corner" }
      ]
    },
    "monthlySubmissionTrends": [...],
    "weeklySubmissionTrends": [...],
    "hrs": [...],
    "reportStats": {
      "totalProfilesShared": 100,
      "totalHRs": 2,
      "totalDesignations": 21,
      "resumeSent": 10,
      "resumeNotSent": 90,
      "silgateInterested": 5,
      "silgateNotInterested": 15,
      "hrWiseSummary": [
        { "hrName": "Pooja Gaikwad", "count": 55 },
        { "hrName": "Anjali Talekar", "count": 45 }
      ],
      "designationWiseSummary": [
        { "designation": "AEM", "count": 16 },
        { "designation": "Pricing Executive", "count": 10 }
      ],
      "sourceWiseSummary": [
        { "source": "Work India", "count": 25, "percentage": 25 },
        { "source": "Naukri", "count": 24, "percentage": 24 }
      ]
    }
  }
  ```

---

### 3.6 Designation CRUD Routes (`/api/designations`)

- **Route Base File**: `./routes/designationRoutes.js`
- **Controller File**: `./contollers/designationController.js`

#### 3.6.1 Create Designation

- **Method**: `POST`
- **Route**: `/api/designations`
- **Headers**: `Authorization: Bearer <Token>`
- **Authorization Rule**: **Superadmin only**
- **Request Body**:
  ```json
  {
    "name": "Software Developer",
    "project": ["Silgate", "Talent Corner"]
  }
  ```
- **Validations**:
  - `name`: Required, non-empty, unique.
  - `project`: Required, array or single string, values must be `"Silgate"` and/or `"Talent Corner"`.
- **Response (201 Created)**:
  ```json
  {
    "message": "Designation created successfully.",
    "data": {
      "_id": "...",
      "name": "Software Developer",
      "project": ["Silgate", "Talent Corner"],
      "createdBy": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### 3.6.2 Get Designations

- **Method**: `GET`
- **Route**: `/api/designations`
- **Headers**: `Authorization: Bearer <Token>`
- **Authentication**: Required (both HR and Superadmin)
- **Query Parameters**:
  - `project` (optional): Filter designations by project name (`"Silgate"` or `"Talent Corner"`).
  - `page` (optional): Page number (defaults to `1`).
  - `limit` (optional): Count per page (defaults to `10`).
- **Response (200 OK)**:
  ```json
  {
    "data": [
      {
        "_id": "...",
        "name": "Software Developer",
        "project": ["Silgate", "Talent Corner"],
        "createdBy": {
          "_id": "...",
          "name": "Superadmin Name"
        },
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "currentPage": 1,
    "totalPages": 1,
    "totalDesignations": 1
  }
  ```

#### 3.6.3 Get Designation By ID

- **Method**: `GET`
- **Route**: `/api/designations/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Authentication**: Required (both HR and Superadmin)
- **Response (200 OK)**:
  ```json
  {
    "data": {
      "_id": "...",
      "name": "Software Developer",
      "project": ["Silgate", "Talent Corner"],
      "createdBy": {
        "_id": "...",
        "name": "Superadmin Name"
      },
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### 3.6.4 Update Designation

- **Method**: `PATCH`
- **Route**: `/api/designations/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Authorization Rule**: **Superadmin only**
- **Request Params**: `id` (The designation database `_id`)
- **Request Body** _(all fields optional)_:
  ```json
  {
    "name": "Senior Software Developer",
    "project": ["Silgate"]
  }
  ```
- **Validations**:
  - `name`: Must be non-empty and unique.
  - `project`: Must contain at least one valid project name.
- **Response (200 OK)**:
  ```json
  {
    "message": "Designation updated successfully.",
    "data": {
      "_id": "...",
      "name": "Senior Software Developer",
      "project": ["Silgate"],
      "createdBy": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### 3.6.5 Delete Designation

- **Method**: `DELETE`
- **Route**: `/api/designations/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Authorization Rule**: **Superadmin only**
- **Response (200 OK)**:
  ```json
  {
    "message": "Designation deleted successfully."
  }
  ```

---

### 3.7 Lead List CRUD Routes (`/api/lists`)

- **Route Base File**: `./routes/listRoutes.js`
- **Controller File**: `./contollers/listController.js`

#### 3.7.1 Create Lead List

- **Method**: `POST`
- **Route**: `/api/lists`
- **Headers**: `Authorization: Bearer <Token>`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "name": "Q3 Hiring Batch",
    "description": "Talent corner leads for Q3 recruitment drive",
    "campaign": "talentCorner",
    "user_id": "60d5ecb8b3b3a1234567890a"
  }
  ```
- **Validations**:
  - `name`: Required non-empty string.
  - `campaign`: Required. Must be a valid campaign (`"talentCorner"`, `"silgate"`, `"Talent Corner"`, or `"Silgate"`).
  - `user_id`: Optional (used when uploading leads).
- **Response (201 Created)**:
  ```json
  {
    "message": "List created successfully.",
    "data": {
      "_id": "...",
      "name": "Q3 Hiring Batch",
      "description": "Talent corner leads for Q3 recruitment drive",
      "campaign": "talentCorner",
      "user_id": {
        "_id": "...",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "createdBy": {
        "_id": "...",
        "name": "Admin User",
        "email": "admin@example.com"
      },
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

#### 3.7.2 Get Lead Lists

- **Method**: `GET`
- **Route**: `/api/lists`
- **Headers**: `Authorization: Bearer <Token>`
- **Query Parameters**:
  - `campaign` (optional): Filter by campaign (`talentCorner`, `silgate`).
  - `user_id` (optional): Filter by assigned user ID.
  - `search` (optional): Filter by list name string match.
  - `page` (optional): Page number (default: 1).
  - `limit` (optional): Records per page (default: 10).
- **Response (200 OK)**:
  ```json
  {
    "data": [
      {
        "_id": "...",
        "name": "Q3 Hiring Batch",
        "description": "...",
        "campaign": "talentCorner",
        "user_id": null,
        "createdBy": {
          "_id": "...",
          "name": "Admin User"
        },
        "createdAt": "..."
      }
    ],
    "currentPage": 1,
    "totalPages": 1,
    "totalLists": 1
  }
  ```

#### 3.7.3 Get Lead List By ID

- **Method**: `GET`
- **Route**: `/api/lists/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Response (200 OK)**:
  ```json
  {
    "data": {
      "_id": "...",
      "name": "Q3 Hiring Batch",
      "description": "...",
      "campaign": "talentCorner",
      "user_id": null,
      "createdBy": {
        "_id": "...",
        "name": "Admin User"
      },
      "createdAt": "..."
    }
  }
  ```

#### 3.7.4 Update Lead List

- **Method**: `PATCH` or `PUT`
- **Route**: `/api/lists/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Authorization Rule**: List Creator or Superadmin
- **Request Body** _(all fields optional)_:
  ```json
  {
    "name": "Updated Q3 Batch",
    "description": "Updated description",
    "campaign": "silgate"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "List updated successfully.",
    "data": {
      "_id": "...",
      "name": "Updated Q3 Batch",
      "campaign": "silgate",
      "updatedAt": "..."
    }
  }
  ```

#### 3.7.5 Delete Lead List

- **Method**: `DELETE`
- **Route**: `/api/lists/:id`
- **Headers**: `Authorization: Bearer <Token>`
- **Authorization Rule**: List Creator or Superadmin
- **Response (200 OK)**:
  ```json
  {
    "message": "List deleted successfully."
  }
  ```

#### 3.7.6 Add JSON Lead Data & Distribute

- **Method**: `POST`
- **Route**: `/api/lists/data` (or `/api/lists/:id/data`)
- **Headers**: `Authorization: Bearer <Token>`, `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "listId": "60d5ecb8b3b3a1234567890a",
    "selectedUserIds": ["60d5ecb8b3b3a1234567890b", "60d5ecb8b3b3a1234567890c"],
    "leadsource": "Work India",
    "data": [
      {
        "candidateName": "John Doe",
        "candidatePhone": "9876543210",
        "candidateLocation": "Mumbai",
        "language": "Hindi",
        "disposition": "New Lead",
        "candidateDesignation": "Software Developer"
      },
      {
        "candidateName": "Jane Smith",
        "candidatePhone": "9123456789",
        "candidateLocation": "Delhi",
        "candidateDesignation": "HR Executive"
      }
    ]
  }
  ```
- **Behavior**:
  - Validates `listId` and target `campaign` (`silgate` vs `talentCorner`).
  - Validates 10-digit mobile numbers for each candidate entry.
  - Distributes leads in round-robin order across `selectedUserIds` (populating `hrId`).
  - Inserts leads into the corresponding campaign collection (`Silgate` or `TalentCorner`).
  - Records an audit log entry.
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "2 lead(s) added successfully under campaign \"silgate\" in Auto Distribution Mode across 2 user(s).",
    "insertedCount": 2,
    "campaign": "silgate",
    "data": [...]
  }
  ```

#### 3.7.7 Upload CSV/Excel Leads & Distribute

- **Method**: `POST`
- **Route**: `/api/lists/import`
- **Headers**: `Authorization: Bearer <Token>`, `Content-Type: multipart/form-data`
- **Form Data**:
  - `file`: Multipart CSV or XLSX file _(Required)_
  - `listId`: Target Lead List ObjectId _(Required)_
  - `selectedUserIds`: Array or JSON string of HR User IDs for auto-distribution _(Optional)_
  - `assignedTo`: HR User ObjectId to assign every imported lead to _(Optional)_
  - `leadsource` / `source`: Source label string _(Optional)_
  - `skipDuplicates`: Boolean or string (`true`/`false`). If `false` (default), rejects upload with `400` error if duplicate phone numbers are found in file or database. If `true`, skips duplicate leads and imports only unique new leads _(Optional)_
- **Validation Rules**:
  - Validates valid 10-digit candidate mobile numbers for every row.
  - Performs phone duplicate validation against both the uploaded file (intra-file duplicates) and existing campaign database entries (`Silgate` or `TalentCorner`).
  - If `skipDuplicates` is `false` (default) and any duplicate phone number is detected, returns `400 Bad Request` specifying exact duplicate phone numbers, row numbers, and where they were found (file vs database).
  - If `skipDuplicates` is `true`, filters out duplicate leads, inserts only unique leads, includes duplicate details in `duplicates` array, and reports `skippedCount` in the response.
- **Response (400 Bad Request - Duplicates Found when skipDuplicates=false)**:
  ```json
  {
    "message": "Duplicate lead(s) found: Row 5 (9876543210): duplicate in file (first seen at row 2); Row 7 (9123456789): already exists in database.",
    "duplicateCount": 2,
    "duplicates": [
      {
        "phone": "9876543210",
        "rowNum": 5,
        "type": "file",
        "details": "Duplicate in uploaded file (first seen at row 2)"
      },
      {
        "phone": "9123456789",
        "rowNum": 7,
        "type": "database",
        "details": "Already exists in database"
      }
    ]
  }
  ```
- **Response (201 Created - Success with skipDuplicates=true)**:
  ```json
  {
    "success": true,
    "message": "5 lead(s) imported successfully into \"silgate\" collection in Auto Distribution Mode across 2 user(s). 2 duplicate lead(s) skipped: Row 5 (9876543210): duplicate in file (first seen at row 2); Row 7 (9123456789): already exists in database.",
    "insertedCount": 5,
    "skippedCount": 2,
    "duplicates": [
      {
        "phone": "9876543210",
        "rowNum": 5,
        "type": "file",
        "details": "Duplicate in uploaded file (first seen at row 2)"
      },
      {
        "phone": "9123456789",
        "rowNum": 7,
        "type": "database",
        "details": "Already exists in database"
      }
    ],
    "campaign": "silgate",
    "data": [...]
  }
  ```

#### 3.7.8 Get List Leads Data

- **Method**: `GET`
- **Route**: `/api/lists/:id/data`
- **Headers**: `Authorization: Bearer <Token>`
- **Query Parameters**: `page` (default: 1), `limit` (default: 10)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "list": {
      "_id": "...",
      "name": "Q3 Hiring Batch",
      "campaign": "silgate"
    },
    "campaign": "silgate",
    "totalLeads": 25,
    "currentPage": 1,
    "totalPages": 3,
    "data": [...]
  }
  ```

#### 3.7.8 Download Sample CSV Lead File

- **Method**: `GET`
- **Route**: `/api/lists/sample` (or `/api/lists/sample/:campaign`)
- **Headers**: `Authorization: Bearer <Token>`
- **Query Parameters**:
  - `campaign`: `"silgate"` or `"talentCorner"` _(Required)_
- **Response (200 OK)**:
  - Triggers a browser file download of `sample_silgate_leads.csv` or `sample_talent_corner_leads.csv` containing correct campaign column headers and sample candidate rows.
