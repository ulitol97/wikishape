import axios from "axios";
import React, { useReducer, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import ProgressBar from "react-bootstrap/ProgressBar";
import Row from "react-bootstrap/Row";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import { ReloadIcon } from "react-open-iconic-svg";
import API from "../API";
import InputSchemaEntityByText from "../components/InputSchemaEntityByText";
import InputShapeLabel from "../components/InputShapeLabel";
import { mkPermalinkLong, params2Form } from "../Permalink";
import QueryForm from "../query/QueryForm";
import { wikidataPrefixes } from "../resources/wikidataPrefixes";
import ResultValidate, {
  mergeResult
} from "../results/ResultValidate";
import { initialShExStatus, paramsFromShEx, shExReducer } from "../shex/ShEx";
import ShExTabs from "../shex/ShExTabs";
import { showQualify } from "../utils/Utils";

function WikidataValidateSPARQL(props) {
  const initialStatus = {
    loading: false,
    error: false,
    result: null,
    permalink: null,
    entities: [],
    shapeList: [],
    shapeLabel: "",
    nodesPrefixMap: wikidataPrefixes,
    shapesPrefixMap: wikidataPrefixes,
  };

  const [status, dispatch] = useReducer(statusReducer, initialStatus);
  const [query, setQuery] = useState("");
  const [schemaEntity, setSchemaEntity] = useState("");
  const [schemaActiveTab, setSchemaActiveTab] = useState("BySchema");
  const [shEx, dispatchShEx] = useReducer(shExReducer, initialShExStatus);
  const urlServer = API.schemaValidate;
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  function handleShapeLabelChange(label) {
    dispatch({ type: "set-shapeLabel", value: label });
  }

  function handleSchemaEntityChange(e) {
    if (e && e.length) {
      const schemaEntity = e[0];
      dispatch({ type: "set-loading", value: true });
      let params = {};
      params["schemaURL"] = schemaEntity.conceptUri;
      params["schemaFormat"] = "ShExC";
      params["schemaEngine"] = "ShEx";
      axios
        .post(API.schemaInfo, params2Form(params), {
          headers: { "Access-Control-Allow-Origin": "*" },
        })
        .then((response) => response.data)
        .then((result) => {
          dispatch({
            type: "set-shapeList",
            value: {
              shapeList: result.shapes,
              shapesPrefixMap: result.prefixMap,
            },
          });
          dispatchShEx({ type: "setUrl", value: schemaEntity.conceptUri });
        })
        .catch((error) => {
          dispatch({ type: "set-error", value: error.message });
        });
      setSchemaEntity(e);
    }
  }

  function statusReducer(status, action) {
    switch (action.type) {
      case "set-loading":
        return { ...status, loading: action.value, error: false };
      case "set-permalink":
        return { ...status, permalink: action.value };
      case "set-result":
        return {
          ...status,
          error: false,
          result: mergeResult(
            status.result,
            action.value,
            status.shapesPrefixMap
          ),
        };
      case "unset-result":
        return { ...status, result: null };
      case "set-shapeLabel":
        return { ...status, shapeLabel: action.value };
      case "set-entities":
        return { ...status, entities: action.value };
      case "set-shapeList":
        const shapesPrefixMap = action.value.shapesPrefixMap;
        const shapeList = action.value.shapeList.map(
          (sl) => showQualify(sl, shapesPrefixMap).str
        );
        const shapeLabel = shapeList && shapeList.length ? shapeList[0] : "";
        return {
          ...status,
          loading: false,
          error: false,
          shapeList: shapeList,
          shapeLabel: shapeLabel,
          shapesPrefixMap: shapesPrefixMap,
        };
      case "set-error":
        return { ...status, loading: false, error: action.value };
      default:
        throw new Error(
          `Unknown action type for statusReducer: ${action.type}`
        );
    }
  }

  function resultFromEntities(entities, shapeLabel) {
    const resultMap = entities.map((e) => {
      return {
        node: e,
        shape: shapeLabel,
        status: "?",
        reason: "validating",
      };
    });
    return {
      valid: false,
      type: "Result",
      shapeMap: resultMap,
      errors: [],
      nodesPrefixMap: wikidataPrefixes, // The prefix map for nodes is wikidata endpoint
      shapesPrefixMap: status.shapesPrefixMap, // the prefix map for shapes can be changed by the ShEx author
    };
  }

  function parseData(data) {
    if (data.head && data.head.vars && data.head.vars.length) {
      const varName = data.head.vars[0];
      return data.results.bindings.map((binding) => {
        const v = binding[varName];
        const converted = cnvValue(v);
        return converted;
      });
    } else {
      return [];
    }
  }

  function cnvValue(value) {
    switch (value.type) {
      case "uri":
        return `<${value.value}>`;
      case "literal":
        if (value.datatype) return `"${value.value}"^^<${value.datatype}>`;
        if (value["xml:lang"]) return `"${value.value}"@${value["xml:lang"]}`;
        return `"${value.value}"`;
      default:
        console.error(`cnvValue: Unknown value type for ${value}`);
        return value;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    resetState();
    let params = {};

    if (query.trim().length === 0) {
      dispatch({
        type: "set-error",
        value: `No query introduced`,
      });
      return;
    }

    params["query"] = query;
    const formDataQuery = params2Form(params);
    dispatch({ type: "set-loading", value: true });
    setProgressPercent(25);
    setProgressLabel("Performing query...");
    axios
      .post(API.wikidataQuery, formDataQuery)
      .then((response) => {
        setProgressPercent(70);
        return response.data;
      })
      .then(async (data) => {
        const entities = parseData(data);
        dispatch({ type: "set-entities", value: entities });
        const paramsShEx = paramsFromShEx(shEx);
        const initialResult = resultFromEntities(entities, status.shapeLabel);
        dispatch({ type: "set-result", value: initialResult });
        setProgressPercent(80);
        dispatch({
          type: "set-permalink",
          value: mkPermalinkLong(API.wikidataValidateSPARQLRoute, params),
        });
        for (const e of entities) {
          const paramsEndpoint = {
            endpoint: localStorage.getItem("url") || API.wikidataContact.url,
          };
          params = { ...paramsEndpoint, ...paramsShEx };
          params["schemaEngine"] = "ShEx";
          params["triggerMode"] = "shapeMap";
          params["shapeMap"] = `${e}@${status.shapeLabel}`;
          params["shapeMapFormat"] = "Compact";
          const formData = params2Form(params);
          postValidate(urlServer, formData, e);
        }
        setProgressPercent(100);
      })
      .catch((error) => {
        dispatch({ type: "set-loading", value: false });
        dispatch({ type: "set-error", value: error.message });
      });
  }

  function postValidate(url, formData, e) {
    setProgressPercent(60);
    setProgressLabel("Validating results...");
    axios
      .post(url, formData)
      .then((response) => {
        setProgressPercent(80);
        return response.data;
      })
      .then((data) => {
        dispatch({ type: "set-result", value: data });
      })
      .catch(function(error) {
        dispatch({
          type: "set-error",
          value: `Error validating ${e} ${url} ${JSON.stringify(
            formData
          )}: ${error}`,
        });
      })
      .finally(() => {
        dispatch({ type: "set-loading", value: false });
      });
  }

  function handleShExTabChange(value) {
    dispatchShEx({ type: "changeTab", value: value });
  }
  function handleShExFormatChange(value) {
    dispatchShEx({ type: "setFormat", value: value });
  }
  function handleShExByTextChange(value) {
    dispatchShEx({ type: "setText", value: value });
  }
  function handleShExUrlChange(value) {
    dispatchShEx({ type: "setUrl", value: value });
  }
  function handleShExFileUpload(value) {
    dispatchShEx({ type: "setFile", value: value });
  }

  function handleTabChange(e) {
    setSchemaActiveTab(e);
  }

  function resetState() {
    dispatch({ type: "unset-result" });
    dispatch({ type: "set-permalink", value: "" });
    dispatch({ type: "set-error", value: "" });
    dispatch({ type: "set-loading", value: false });
    setProgressPercent(0);
    setProgressLabel("");
  }

  return (
    <Container>
      <h1>Validate Wikibase entities obtained from SPARQL queries</h1>
      <h4>
        Target SPARQL endpoint:{" "}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={API.currentEndpoint()}
        >
          {API.currentEndpoint()}
        </a>
      </h4>
      <Row>
        <Form onSubmit={handleSubmit}>
          <QueryForm
            onChange={setQuery}
            placeholder="select ?id ..."
            value={query}
            prefixes={wikidataPrefixes}
          />
          <Tabs
            activeKey={schemaActiveTab}
            transition={false}
            id="SchemaTabs"
            onSelect={handleTabChange}
          >
            <Tab eventKey="BySchema" title="Wikidata schema">
              <InputSchemaEntityByText
                onChange={handleSchemaEntityChange}
                entity={schemaEntity}
              />
            </Tab>
            <Tab eventKey="ByShExTab" title="ShEx">
              <ShExTabs
                activeTab={shEx.shExActiveTab}
                handleTabChange={handleShExTabChange}
                textAreaValue={shEx.shExTextArea}
                handleByTextChange={handleShExByTextChange}
                shExUrl={shEx.shExUrl}
                handleShExUrlChange={handleShExUrlChange}
                handleFileUpload={handleShExFileUpload}
                dataFormat={shEx.shExFormat}
                handleShExFormatChange={handleShExFormatChange}
              />
            </Tab>
          </Tabs>
          <InputShapeLabel
            onChange={handleShapeLabelChange}
            value={status.shapeLabel}
            shapeList={status.shapeList}
          />
          <Button
            className={"btn-with-icon " + (status.loading ? "disabled" : "")}
            variant="primary"
            type="submit"
            disabled={status.loading}
          >
            Validate entities
            <ReloadIcon className="white-icon" />
          </Button>
        </Form>
      </Row>

      <Row style={{ display: "block" }}>
        {status.loading ? (
          <ProgressBar
            style={{ width: "100%" }}
            striped
            animated
            variant="info"
            now={progressPercent}
            label={progressLabel}
          />
        ) : status.error ? (
          <Alert variant="danger">{status.error}</Alert>
        ) : status.result ? (
          <ResultValidate result={status.result} permalink={status.permalink} />
        ) : null}
      </Row>
    </Container>
  );
}

export default WikidataValidateSPARQL;
