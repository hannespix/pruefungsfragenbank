-- Design draft for a future authenticated PHP service, not a deployed backend.
-- Validate against the actual MySQL/MariaDB version before applying.
-- IDs are portable strings from the offline schema. Binary files belong in
-- private storage; asset metadata points to an authenticated download handler.
CREATE TABLE hx_projects (
 id VARCHAR(191) PRIMARY KEY,
 name VARCHAR(255) NOT NULL,
 schema_version INT NOT NULL,
 revision BIGINT NOT NULL DEFAULT 1,
 created_at DATETIME NOT NULL
) CHARACTER SET utf8mb4;
CREATE TABLE hx_families (
 project_id VARCHAR(191) NOT NULL,
 id VARCHAR(191) NOT NULL,
 title VARCHAR(255) NOT NULL,
 payload JSON NOT NULL,
 PRIMARY KEY(project_id,id),
 FOREIGN KEY(project_id) REFERENCES hx_projects(id)
) CHARACTER SET utf8mb4;
CREATE TABLE hx_assets (
 project_id VARCHAR(191) NOT NULL,
 id VARCHAR(191) NOT NULL,
 filename VARCHAR(255) NOT NULL,
 mime_type VARCHAR(127) NOT NULL,
 storage_key VARCHAR(255) NOT NULL,
 sha256 CHAR(64) NOT NULL,
 PRIMARY KEY(project_id,id),
 FOREIGN KEY(project_id) REFERENCES hx_projects(id)
) CHARACTER SET utf8mb4;
CREATE TABLE hx_sources (
 project_id VARCHAR(191) NOT NULL,
 id VARCHAR(191) NOT NULL,
 asset_id VARCHAR(191),
 source_year SMALLINT,
 year_evidence VARCHAR(32) NOT NULL,
 payload JSON NOT NULL,
 PRIMARY KEY(project_id,id),
 FOREIGN KEY(project_id,asset_id) REFERENCES hx_assets(project_id,id)
) CHARACTER SET utf8mb4;
CREATE TABLE hx_tasks (
 project_id VARCHAR(191) NOT NULL,
 id VARCHAR(191) NOT NULL,
 family_id VARCHAR(191) NOT NULL,
 previous_id VARCHAR(191),
 specialty VARCHAR(100) NOT NULL,
 exam_type VARCHAR(8) NOT NULL,
 solution_status VARCHAR(16) NOT NULL,
 payload JSON NOT NULL,
 PRIMARY KEY(project_id,id),
 INDEX hx_task_filter(project_id,specialty,exam_type),
 FOREIGN KEY(project_id,family_id) REFERENCES hx_families(project_id,id)
) CHARACTER SET utf8mb4;
CREATE TABLE hx_task_sources (
 project_id VARCHAR(191) NOT NULL,
 task_id VARCHAR(191) NOT NULL,
 source_id VARCHAR(191) NOT NULL,
 PRIMARY KEY(project_id,task_id,source_id),
 FOREIGN KEY(project_id,task_id) REFERENCES hx_tasks(project_id,id),
 FOREIGN KEY(project_id,source_id) REFERENCES hx_sources(project_id,id)
) CHARACTER SET utf8mb4;
CREATE TABLE hx_exams (
 project_id VARCHAR(191) NOT NULL,
 id VARCHAR(191) NOT NULL,
 title VARCHAR(255) NOT NULL,
 planned_date DATE,
 status VARCHAR(16) NOT NULL,
 revision BIGINT NOT NULL DEFAULT 1,
 payload JSON NOT NULL,
 PRIMARY KEY(project_id,id),
 FOREIGN KEY(project_id) REFERENCES hx_projects(id)
) CHARACTER SET utf8mb4;
CREATE TABLE hx_exam_items (
 project_id VARCHAR(191) NOT NULL,
 exam_id VARCHAR(191) NOT NULL,
 id VARCHAR(191) NOT NULL,
 original_task_id VARCHAR(191) NOT NULL,
 position INT NOT NULL,
 snapshot JSON NOT NULL,
 PRIMARY KEY(project_id,exam_id,id),
 UNIQUE(project_id,exam_id,position),
 FOREIGN KEY(project_id,exam_id) REFERENCES hx_exams(project_id,id),
 FOREIGN KEY(project_id,original_task_id) REFERENCES hx_tasks(project_id,id)
) CHARACTER SET utf8mb4;
CREATE TABLE hx_uses (
 project_id VARCHAR(191) NOT NULL,
 id VARCHAR(191) NOT NULL,
 exam_id VARCHAR(191) NOT NULL,
 actual_date DATE NOT NULL,
 payload JSON NOT NULL,
 PRIMARY KEY(project_id,id),
 UNIQUE(project_id,exam_id,actual_date),
 FOREIGN KEY(project_id,exam_id) REFERENCES hx_exams(project_id,id)
) CHARACTER SET utf8mb4;
-- Authentication, membership/roles, task/source asset joins and audit tables
-- must be added with the backend. Do not expose this schema directly to clients.
