-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('HOME_INTERNET', 'HOTSPOT_WIFI', 'MOBILE_RECHARGE', 'ELECTRICITY_BILL');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OwnershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_packages" (
    "id" UUID NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(15,2) NOT NULL,
    "commission" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "validity" INTEGER,
    "bandwidth" VARCHAR(50),
    "data_limit" VARCHAR(50),
    "status" "PackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "excel_package_id" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_services" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "connection_id" VARCHAR(50) NOT NULL,
    "subscriber_name" VARCHAR(100) NOT NULL,
    "address" TEXT NOT NULL,
    "area" VARCHAR(100),
    "status" "OwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "activated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "wallet_transaction_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotspot_services" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "device_mac" VARCHAR(20),
    "voucher_code" VARCHAR(50),
    "zone_id" VARCHAR(50),
    "status" "OwnershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "activated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "wallet_transaction_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotspot_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_recharges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mobile_number" VARCHAR(15) NOT NULL,
    "operator" VARCHAR(30) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "recharge_type" VARCHAR(20) NOT NULL,
    "execution_status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "external_reference" VARCHAR(255),
    "wallet_transaction_id" VARCHAR(255),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_recharges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electricity_bills" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "meter_number" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "account_holder" VARCHAR(100),
    "amount" DECIMAL(15,2) NOT NULL,
    "bill_month" VARCHAR(20),
    "execution_status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "external_reference" VARCHAR(255),
    "wallet_transaction_id" VARCHAR(255),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "electricity_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_execution_logs" (
    "id" UUID NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "service_record_id" VARCHAR(255) NOT NULL,
    "package_id" UUID,
    "user_id" UUID NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "wallet_transaction_id" VARCHAR(255),
    "refund_transaction_id" VARCHAR(255),
    "executed_by" VARCHAR(255),
    "execution_method" VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC',
    "error_message" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_packages_excel_package_id_key" ON "service_packages"("excel_package_id");

-- CreateIndex
CREATE INDEX "service_packages_service_type_status_idx" ON "service_packages"("service_type", "status");

-- CreateIndex
CREATE INDEX "service_packages_excel_package_id_idx" ON "service_packages"("excel_package_id");

-- CreateIndex
CREATE UNIQUE INDEX "home_services_connection_id_key" ON "home_services"("connection_id");

-- CreateIndex
CREATE INDEX "home_services_user_id_idx" ON "home_services"("user_id");

-- CreateIndex
CREATE INDEX "home_services_connection_id_idx" ON "home_services"("connection_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotspot_services_voucher_code_key" ON "hotspot_services"("voucher_code");

-- CreateIndex
CREATE INDEX "hotspot_services_user_id_idx" ON "hotspot_services"("user_id");

-- CreateIndex
CREATE INDEX "hotspot_services_voucher_code_idx" ON "hotspot_services"("voucher_code");

-- CreateIndex
CREATE INDEX "mobile_recharges_user_id_idx" ON "mobile_recharges"("user_id");

-- CreateIndex
CREATE INDEX "mobile_recharges_mobile_number_idx" ON "mobile_recharges"("mobile_number");

-- CreateIndex
CREATE INDEX "mobile_recharges_execution_status_idx" ON "mobile_recharges"("execution_status");

-- CreateIndex
CREATE INDEX "electricity_bills_user_id_idx" ON "electricity_bills"("user_id");

-- CreateIndex
CREATE INDEX "electricity_bills_meter_number_idx" ON "electricity_bills"("meter_number");

-- CreateIndex
CREATE INDEX "electricity_bills_execution_status_idx" ON "electricity_bills"("execution_status");

-- CreateIndex
CREATE INDEX "service_execution_logs_service_type_status_idx" ON "service_execution_logs"("service_type", "status");

-- CreateIndex
CREATE INDEX "service_execution_logs_user_id_idx" ON "service_execution_logs"("user_id");

-- CreateIndex
CREATE INDEX "service_execution_logs_wallet_transaction_id_idx" ON "service_execution_logs"("wallet_transaction_id");

-- CreateIndex
CREATE INDEX "service_execution_logs_created_at_idx" ON "service_execution_logs"("created_at");

-- AddForeignKey
ALTER TABLE "home_services" ADD CONSTRAINT "home_services_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotspot_services" ADD CONSTRAINT "hotspot_services_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_execution_logs" ADD CONSTRAINT "service_execution_logs_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "service_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
