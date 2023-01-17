import { Button, Checkbox, Form, Input, List, Result } from "antd";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { SearchResultModel } from "./model";

const model = new SearchResultModel();

export const Example1 = observer(() => {
  const { inputSearchModel, filterModel } = model;
  useEffect(() => {
    return model.connect();
  }, []);

  const refreshButton = <Button onClick={model.onRefresh}>Refresh</Button>;

  return (
    <>
      <Form style={{ width: "800px" }}>
        <Form.Item label="keyword">
          <Input
            value={inputSearchModel.keyword}
            allowClear
            onChange={(e) => inputSearchModel.onInput(e.target.value)}
            onPressEnter={() => inputSearchModel.onPressEnter()}
          />
        </Form.Item>
        <Form.Item label="checked">
          <Checkbox
            checked={filterModel.filterState.checked}
            onChange={(e) => filterModel.onChange("checked", e.target.checked)}
          >
            Checked
          </Checkbox>
        </Form.Item>
        {model.resultVisible && <Form.Item>{refreshButton}</Form.Item>}
      </Form>
      {model.resultVisible &&
        (model.error ? (
          <Result
            title={model.error.message}
            status="500"
            extra={refreshButton}
          />
        ) : (
          <List
            loading={model.loading}
            dataSource={model.result}
            renderItem={(item) => <List.Item key={item}>{item}</List.Item>}
          />
        ))}
    </>
  );
});

Example1.displayName = "Example1";
