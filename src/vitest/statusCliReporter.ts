import { vitestStatusReporter } from "./statusReporter";

export default class VitestStatusCliReporter {
  private readonly reporter = vitestStatusReporter();

  onTestCaseResult = this.reporter.onTestCaseResult?.bind(this.reporter);

  onTestRunEnd = this.reporter.onTestRunEnd?.bind(this.reporter);
}
