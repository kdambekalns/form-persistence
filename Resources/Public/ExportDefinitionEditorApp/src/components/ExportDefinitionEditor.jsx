import React, { useEffect, useState } from 'react';
import update from 'react-addons-update';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import flatten from 'arr-flatten';
import unique  from 'array-unique'
import InputLine from './InputLine';
import { unique as uniqueHelper } from '../utility/Helper';
import { isSuitable } from '../utility/Helper';

const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    return result;
};

const InputLines = ({ lines, formFieldNameChanged, conversionFieldNameChanged, removeLine, formFields }) => {
    return lines.map((line, index) => (
        <InputLine
            inputLine={line}
            index={index}
            key={line.id}
            formFields={formFields}
            formFieldNameChanged={formFieldNameChanged}
            conversionFieldNameChanged={conversionFieldNameChanged}
            removeLine={removeLine}
        />
    ));
};

const generateFormFieldsForExportDefinition = (formsData, exportDefinitionFields = []) => {
    if (exportDefinitionFields.length === 0 ) {
        return unique(flatten(formsData.map((formData) => {
            return formData.processedFieldNames
        })));
    }
    return unique(flatten(formsData.map((formData) => {
        if (isSuitable(formData.processedFieldNames, exportDefinitionFields)) {
            return formData.processedFieldNames
        }
    })));
}

const ExportDefinitionEditor = ({ reset, definitionIdentifier, apiFormData, apiExportDefinition, action }) => {

    let allFormsData = {};
    const initialState = {
        label: '',
        types: [],
        lines: [],
        keyStart: 0
    };

    const [state, setState] = useState(initialState);
    const [isLoading, setIsLoading] = useState(true);
    const [list, setList] = useState([]);
    const [formIdentifier, setSelectedFormIdentifier] = useState('')

    const fetchData = () => {
        Promise.all([
            fetch(apiFormData),
            fetch(apiExportDefinition + '/' + definitionIdentifier),
            fetch(apiExportDefinition)
        ]).then(([formsDataResponse, exportDefinitionResponse, allExportDefinitionResponse]) => {
            Promise.all([
                formsDataResponse.json(),
                exportDefinitionResponse.json(),
                allExportDefinitionResponse.json()
            ]).then(([formsData, exportDefinitionData, allExportDefinitionsData]) => {
                allFormsData = formsData
                const list = allFormsData.map((item) => {
                    return {
                        id: item.__identity,
                        label: item.formIdentifier + '-' + item.hash.substring(0, 10)
                    }
                })
                setList(list)
                setSelectedFormIdentifier(allFormsData[0].__identity)
                const uniqueFormFields = generateFormFieldsForExportDefinition(allFormsData, Object.keys(exportDefinitionData.definition))
                const data = {
                    label: exportDefinitionData.label || '',
                    types: allExportDefinitionsData.length > 0 ? uniqueHelper(allExportDefinitionsData.map((item) => {
                        return {
                            label: item.exporter,
                            value: item.exporter
                        };
                    }), 'label') : [{ label: 'csv', value: 'csv' }],
                    lines: Object.keys(exportDefinitionData?.definition || {}).map((item, index) => {
                        return {
                            id: `id-${index}`,
                            value: item,
                            conversionValue: exportDefinitionData.definition[item].changeKey
                        };
                    }),
                    keyStart: Object.keys(exportDefinitionData?.definition || {}).length || 0,
                    formFields:uniqueFormFields.map((item) => {
                        return {
                            id: item,
                            label: item
                        };
                    }),
                    selectedType: exportDefinitionData?.exporter || allExportDefinitionsData[0]?.exporter || 'csv'
                };
                setState(data);
            })
        }).catch(error => {
            console.error('An Error occurred:', error);
        }).finally(() => {
            setIsLoading(false);
        });
    }

    useEffect(() => {
        fetchData();
    }, []);

    const addLine = () => {
        const line = {
            id: `id-${state.keyStart + 1}`
        };
        setState(update(state, {
            lines: {
                $push: [line]
            },
            keyStart: { $set: state.keyStart + 1 }
        }));
        updateFormSelectOptions()
    };

    const formFieldNameChanged = (event, index) => {
        setState(update(state, {
            lines: {
                [index]: {
                    value: {
                        $set: event.target.value
                    }
                }
            }
        }));
        updateFormSelectOptions();
    };

    const conversionFieldNameChanged = (event, index) => {
        setState(update(state, {
            lines: {
                [index]: {
                    conversionValue: {
                        $set: event.target.value
                    }
                }
            }
        }));
    };

    const onDragEnd = (result) => {
        if (!result.destination) {
            return;
        }

        if (result.destination.index === result.source.index) {
            return;
        }

        const lines = reorder(
            state.lines,
            result.source.index,
            result.destination.index
        );

        setState(update(state, {
            lines: {
                $set: lines
            }
        }));
    };

    const removeLine = (index) => {
        setState(update(state, {
            lines: {
                $splice: [[index, 1]]
            }
        }));
        updateFormSelectOptions();
    };

    const sendData = () => {
        setIsLoading(true);

        const data = {
            label: state.label,
            exporter: state.selectedType,
            definition: Object.assign({}, ...state.lines.map((line) => {
                return {
                    [line.value]: {
                        changeKey: line.conversionValue
                    }
                };
            }))
        };
        if (action === 'create') {
            fetch(apiExportDefinition, {
                headers: {
                    'Content-type': 'application/json; charset=UTF-8'
                },
                method: 'POST',
                body: JSON.stringify(data)
            }).then(response => {
                if (!response.ok) {
                    throw response;
                }
                fetchData();
            }).catch(error => {
                console.error('An Error occurred:', error);
            })
        } else {
            fetch(apiExportDefinition + '/' + definitionIdentifier, {
                headers: {
                    'Content-type': 'application/json; charset=UTF-8'
                },
                method: 'PUT',
                body: JSON.stringify(data)
            }).then(response => {
                if (!response.ok) {
                    throw response;
                }
                fetchData();
            }).catch(error => {
                console.error('An Error occurred:', error);
            })
        }
    };

    const onLabelChanged = (event) => {
        setState(update(state, {
            label: {
                $set: event.target.value
            }
        }));
    };

    const onTypeSelected = (event) => {
        setState(update(state, {
            selectedType: {
                $set: event.target.value
            }
        }));
    };

    const onFormSelected = (event) => {
        setSelectedFormIdentifier(event.target.value);
    }

    const updateFormSelectOptions =() => {
        const currentDefinitionFields = state.lines.map((line) => {
            return line.value
        });

        const list = allFormsData.map((item) => {
            if (isSuitable(item.processedFieldNames, currentDefinitionFields)) {
                return {
                    id: item.__identity,
                    label: item.formIdentifier + '-' + item.hash.substring(0, 10)
                }
            }
        })
        setList(list)
    }

    return (
        <>
            <div className={'neos-row-fluid'}>
                <div className={'neos-span8 neos-table'}>
                    <legend>Export Definition</legend>
                    {isLoading ? <div>Loading...</div> :
                        <>
                            <div className={'neos-control-group'}>
                                <label className={'neos-control-label'} htmlFor={'id-label'}>
                                    Label
                                </label>
                                <div className={'neos-controls'}>
                                    <input className={'neos-span12'} value={state.label} onChange={onLabelChanged} id={'id-label'} type={'text'}/>
                                </div>
                            </div>
                            <div className={'neos-control-group'}>
                                <label className={'neos-control-label'} htmlFor={'id-type'}>
                                    Type
                                </label>
                                <div className={'neos-controls'}>
                                     <select className={'neos-span12'} value={state.selectedType} onChange={onTypeSelected} id={'id-type'}>
                                        {
                                            state.types.map(item => {
                                                return <option key={item.value} value={item.value}>{item.label}</option>;
                                            })
                                        }
                                    </select>
                                </div>
                            </div>
                            <div className={'neos-control-group'}>
                                <label className={'neos-control-label'} htmlFor={'form-selection'}>Select a form</label>
                                <div className={'neos-controls'}>
                                    {list.length > 0 ?
                                        <select className={'neos-span12'} onChange={onFormSelected} value={formIdentifier} id={'form-selection'}>
                                            {
                                                list.map(item => {
                                                    return <option key={item.id} value={item.id}>{item.label}</option>
                                                })
                                            }
                                        </select>
                                        : <div className={'neos-span12 aCenter'}>Please create an export definition.</div>
                                    }
                                </div>
                            </div>
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="assosittive-fields">
                                    {provided => (
                                        <div ref={provided.innerRef} {...provided.droppableProps}>
                                            <InputLines
                                                lines={state.lines}
                                                formFields={state.formFields}
                                                formFieldNameChanged={formFieldNameChanged}
                                                conversionFieldNameChanged={conversionFieldNameChanged}
                                                removeLine={removeLine}
                                            />
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                            <div className={'neos-pull-right'}>
                                <button className={'neos-button neos-button-primary'} onClick={addLine}><i className={'fas fa-plus icon-white'}/> Add a field association</button>
                                <button className={'neos-button neos-button-primary'} onClick={sendData}><i className={'fas fa-save icon-white'}/> Save export definition</button>
                            </div>
                        </>
                    }
                </div>
            </div>
            <div className={'neos-row-fluid'}>
                <div className={'neos-span4'}>
                    <button className={'neos-button neos-button-primary'} onClick={reset}><i className={'fas fa-chevron-left icon-white'}/> Back to export definition listing</button>
                </div>
            </div>
        </>
    );
}

export default ExportDefinitionEditor;
