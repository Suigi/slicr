import { vitestChimeReporter } from "./chimeReporter";

export default class VitestChimeCliReporter {
  private readonly reporter = vitestChimeReporter();

  onInit = this.reporter.onInit?.bind(this.reporter);

  onTestRunEnd = this.reporter.onTestRunEnd?.bind(this.reporter);
}
