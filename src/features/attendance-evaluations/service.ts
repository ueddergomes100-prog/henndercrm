import type {
  AttendanceEvaluation,
  AttendanceEvaluationDataset,
  AttendanceEvaluationQueryDto,
  AttendanceEvaluationSubmissionDto,
  AttendanceEvaluationUpdateDto,
} from "./types";

export interface AttendanceEvaluationSource {
  load(query?: AttendanceEvaluationQueryDto): Promise<AttendanceEvaluationDataset>;
}

export interface AttendanceEvaluationGateway extends AttendanceEvaluationSource {
  update(
    input: AttendanceEvaluationUpdateDto,
  ): Promise<AttendanceEvaluation>;
  submit(
    input: AttendanceEvaluationSubmissionDto,
  ): Promise<AttendanceEvaluation>;
}

class UnconnectedAttendanceEvaluationSource implements AttendanceEvaluationSource {
  async load(): Promise<AttendanceEvaluationDataset> {
    return {
      evaluations: [],
      updatedAt: null,
      sourceConnected: false,
    };
  }
}

export const attendanceEvaluationSource: AttendanceEvaluationSource =
  new UnconnectedAttendanceEvaluationSource();
