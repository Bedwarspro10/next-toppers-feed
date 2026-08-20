import { useEffect, useState } from "react";
import SubjectDetailLegacy from "@/pages/SubjectDetailLegacy";
import { useLocation, useRoute } from "wouter";
import { CourseContentView } from "@/components/CourseContentView";
import { resolveDefaultCourseId } from "@/lib/courseEngine";
import type { SubjectId } from "@/lib/subjectRecognition";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";

const VALID_SUBJECTS: SubjectId[] = ["maths", "science", "sst", "english", "hindi"];

export default function SubjectDetail() {
  const [, params] = useRoute("/subjects/:subject");
  const [location] = useLocation();
  const { isAdmin } = useAuth();
  const [courseId, setCourseId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    resolveDefaultCourseId("176").then((id) => alive && setCourseId(id)).catch(() => alive && setCourseId(null));
    return () => { alive = false; };
  }, []);

  const subject = (params?.subject ?? "").toLowerCase() as SubjectId;
  const legacy = isAdmin && new URLSearchParams(location.split("?")[1] ?? "").get("legacy") === "1";


  if (!VALID_SUBJECTS.includes(subject)) {
    return <Layout><div className="max-w-3xl mx-auto p-8 text-center text-muted-foreground">Subject unavailable.</div></Layout>;
  }
  if (legacy) return <SubjectDetailLegacy />;
  if (!courseId) return <Layout><div className="min-h-[55vh] flex items-center justify-center text-sm text-muted-foreground">Loading course content…</div></Layout>;
  return <CourseContentView subject={subject} courseId={courseId} />;
}

