import Link from "next/link";
import { BrandSymbol } from "@/components/ui/CelestialArt";
import styles from "./admin.module.css";

export function AdminBrand() {
  return <Link href="/admin" className={styles.brand} aria-label="Huyền Cơ — Tổng quan quản trị">
    <span className={styles.brandMark} aria-hidden="true"><BrandSymbol /></span>
    <span>Huyền Cơ<small>QUẢN TRỊ WEBSITE</small></span>
  </Link>;
}
