import { NodeCard } from '../../NodeCard';
import type { DiagramScenarioGroup, DiagramScenarioNode } from '../../diagram/rendererContract';
import { SCENARIO_GROUP_MEASURE_CLASS } from '../../nodeMeasurement';

type ScenarioGroupMeasureLayerProps = {
  scenarioGroups: DiagramScenarioGroup[];
  overviewNodeDataVisible: boolean;
};

function toScenarioNodeCardProps(entry: DiagramScenarioNode) {
  return {
    node: entry.node ?? {
      type: entry.type,
      name: entry.title,
      alias: null,
      stream: null,
      key: entry.key,
      data: null,
      srcRange: entry.srcRange
    },
    nodePrefix: entry.nodePrefix ?? entry.prefix
  };
}

export function ScenarioGroupMeasureLayer({
  scenarioGroups,
  overviewNodeDataVisible
}: ScenarioGroupMeasureLayerProps) {
  if (scenarioGroups.length === 0) {
    return null;
  }

  return (
    <div className="scenario-group-measure-layer" aria-hidden="true">
      {scenarioGroups.map((group) => (
        <div
          key={group.key}
          className={SCENARIO_GROUP_MEASURE_CLASS}
          data-scenario-group-key={group.key}
        >
          {group.scenarios.map((scenario) => (
            <section
              key={`${scenario.name}-${scenario.srcRange.from}`}
              className="scenario-box"
            >
              <h3 className="scenario-title">{scenario.name}</h3>
              <div className="scenario-section">
                <div className="scenario-section-label">Given</div>
                {scenario.given.map((entry, index) => (
                  <NodeCard
                    key={`${scenario.name}-given-${entry.key}-${index}`}
                    {...toScenarioNodeCardProps(entry)}
                    className={`scenario-node-card ${entry.className ?? ''}`.trim()}
                    hideData={!overviewNodeDataVisible}
                  />
                ))}
              </div>
              <div className="scenario-section">
                <div className="scenario-section-label">When</div>
                {scenario.when && (
                  <NodeCard
                    {...toScenarioNodeCardProps(scenario.when)}
                    className={`scenario-node-card ${scenario.when.className ?? ''}`.trim()}
                    hideData={!overviewNodeDataVisible}
                  />
                )}
              </div>
              <div className="scenario-section">
                <div className="scenario-section-label">Then</div>
                {scenario.then.map((entry, index) => (
                  <NodeCard
                    key={`${scenario.name}-then-${entry.key}-${index}`}
                    {...toScenarioNodeCardProps(entry)}
                    className={`scenario-node-card ${entry.className ?? ''}`.trim()}
                    hideData={!overviewNodeDataVisible}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
