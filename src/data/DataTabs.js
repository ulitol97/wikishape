import PropTypes from "prop-types";
import React from "react";
import API from "../API";
import InputTabsWithFormat from "../components/InputTabsWithFormat";
import TurtleForm from "../deletedFiles/TurtleForm.delete";

function DataTabs(props) {
  const turtleForm = (
    <TurtleForm
      onChange={props.handleByTextChange}
      value={props.textAreaValue}
    />
  );
  return (
    <div>
      <InputTabsWithFormat
        nameInputTab="RDF data"
        activeTab={props.activeTab}
        handleTabChange={props.handleTabChange}
        byTextName="RDF data"
        textAreaValue={props.textAreaValue}
        byTextPlaceholder="RDF data..."
        handleByTextChange={props.handleByTextChange}
        inputForm={turtleForm}
        byUrlName="URL data"
        handleUrlChange={props.handleDataUrlChange}
        urlValue={props.dataUrl}
        byURLPlaceholder="http://..."
        byFileName="RDF File"
        handleFileUpload={props.handleFileUpload}
        nameFormat="Data format"
        defaultFormat={props.dataFormat}
        handleFormatChange={props.handleDataFormatChange}
        urlFormats={API.dataFormats}
      />
    </div>
  );
}

DataTabs.propTypes = {
  activeTab: PropTypes.string,
  textAreaValue: PropTypes.string,
  handleByTextChange: PropTypes.func.isRequired,
  handleFileUpload: PropTypes.func.isRequired,
  handleDataUrlChange: PropTypes.func.isRequired,
  dataFormat: PropTypes.string.isRequired,
  handleDataFormatChange: PropTypes.func.isRequired,
};

DataTabs.defaultProps = {
  activeTab: "ByText",
  dataFormat: "TURTLE",
};

export default DataTabs;
