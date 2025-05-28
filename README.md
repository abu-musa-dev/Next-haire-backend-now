# 🧩 NextHire – Backend API

This is the **backend** for **NextHire**, a full-stack job portal web app connecting job seekers and employers. It is built using **Node.js**, **Express.js**, **MongoDB**, and includes secure RESTful APIs, role-based access, and Stripe integration for payments.

---

## 📦 Features

- 📄 **RESTful API** for managing jobs, applications, users, and roles
- 🔐 **Role-Based Access Control (RBAC)** for Admin, Employer, and Job Seeker
- 💳 **Stripe Integration** for payment functionality
- 🌐 **CORS-enabled** and connected to React frontend
- 🔍 Filterable endpoints for jobs and applicants
- 📬 Clean error handling and status responses

---

## 🔧 Technologies Used

| Category         | Tools / Libraries           |
|------------------|-----------------------------|
| Runtime          | Node.js                     |
| Framework        | Express.js                  |
| Database         | MongoDB + Mongoose          |
| Auth & Roles     | Firebase Authentication (frontend) + role middleware |
| Payment Gateway  | Stripe                      |
| API Handling     | Axios (frontend) + Express Routes |
| Environment      | dotenv                      |
| Security         | CORS, helmet, express-rate-limit |
| Validation       | Express Validator / Mongoose |

---

## 🛠️ API Endpoints

### 🔐 Auth (handled in frontend via Firebase)

Roles and user data are stored in MongoDB after login.


