var savedConfig = null;
var installed = false;
var agentLists = null;
var loggedInUserId = null;
var loggedInUserInfo = null;
var filteredWorkspaces = null;
var client, domain, api_key;
var iparamCached = false;
var cachedIparam = {};
var workspaceData = null

function showLvl2Config() {
  getAllAgents();
  $("#iparams-lvl1").hide();
  $("#iparams-lvl2").show();
  $("#domain-apikey").hide();
  initsaveIparams();
}

function IsValidJSONString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

function initiparamfroala(workspaceId) {
  var selector = `#emailbody-content-${workspaceId}`;
  var a = ["bold", "italic", "underline", "|", "fontFamily", "fontSize", "color", "align", "|", "formatOL", "formatUL", "|", "insertLink", "insertImage", "|", "spellChecker", "|", "clearFormatting"];
  var i = [
    "#61BD6D",
    "#1ABC9C",
    "#54ACD2",
    "#2C82C9",
    "#9365B8",
    "#475577",
    "#00A885",
    "#3D8EB9",
    "#2969B0",
    "#553982",
    "#28324E",
    "#000000",
    "#F7DA64",
    "#FBA026",
    "#EB6B56",
    "#E25041",
    "#A38F84",
    "#FFFFFF",
    "#FAC51C",
    "#F37934",
    "#B8312F",
    "#7C706B",
    "#D1D5D8",
    "REMOVE"
  ];
  var o = {
    charCounterCount: !1,
    quickInsertButtons: !1,
    editorClass: "ticket-note-typography",
    key: "Qg1Ti1LXd2URVJh1DWXG==",
    toolbarBottom: !1,
    imageMove: !1,
    // imageInsertButtons:["imageByURL"],
    imageInsertButtons: ["imageBack", "|", "imageByURL"],
    linkInsertButtons: ["linkBack"],
    linkEditButtons: ["linkOpen", "linkEdit", "linkRemove"],
    toolbarButtons: a,
    imageDefaultAlign: "left",
    focusOnMarker: !0,
    toolbarButtonsSM: a,
    toolbarButtonsXS: a,
    colorsBackground: i,
    colorsText: i,
    colorsStep: 6,
    imageUploadRemoteUrls: false,
    // imageUpload: false,
    imagePaste: true,
    htmlUntouched: true,
    useClasses: false,
    height: 200,
    pluginsEnabled: ["image", "link", "draggable", "codeView", "list", "colors", "align", "fontFamily", "fontSize", "lineBreaker", "specialCharacters", "table", "url", "spellChecker"]
  };
  // $(selector).froalaEditor(o);
  $(selector)
    .on("froalaEditor.initialized", function () {
      console.log("editor initializec");
    })
    .on("froalaEditor.contentChanged", function () {
      // Des
    })
    .on("froalaEditor.focus", function () {
      // Des
    })
    .froalaEditor(o);
}

window.insertPlaceholder = function (t, workspaceId) {
  var placeholder;
  var dict = {
    agentname: "ticket.agent.name",
    agentemail: "ticket.agent.email",
    requestername: "ticket.requester.name",
    ticketurl: "ticket.url"
  };
  placeholder = dict[t];
  $("#emailbody-content-" + workspaceId).froalaEditor("html.insert", "{{" + placeholder + "}}", true);
};
window.handleCheckboxClick = function (checkbox, workspaceId) {
  initiparamfroala(workspaceId);
  if ($(checkbox).is(":checked")) {
    $("#oooresponse-" + workspaceId).css("max-height", "400px");
    $(checkbox)
      .closest(".row.pad20")
      .find(".inner")
      .css("height", "405px");
  } else {
    $("#oooresponse-" + workspaceId).css("max-height", "0");
    $(checkbox)
      .closest(".row.pad20")
      .find(".inner")
      .css("height", "1%");
  }
};

window.reassignTicketChange = function (checkbox, workspaceId) {

  if ($(checkbox).is(":checked")) {
    $("#reassign-" + workspaceId).css("max-height", "500px");
    $(checkbox)
      .closest(".row.pad20")
      .find(".inner")
      .css("height", "175px");
    $("#unassignticket-" + workspaceId)
      .prop("checked", false)
      .trigger("change");
  } else {
    $("#reassign-" + workspaceId).css("max-height", "0");
    $(checkbox)
      .closest(".row.pad20")
      .find(".inner")
      .css("height", "0");
  }
}

window.unAssignTicketChange = function (checkbox, workspaceId) {
  if ($(checkbox).is(":checked")) {
    $("#reassigntickettogroup-" + workspaceId)
      .prop("checked", false)
      .trigger("change");
  }
}

async function getAllAgents() {
  try {

    var req_path = "/api/v2/agents";
    const agentData = await client.request.invokeTemplate("getRequestApiTemplate", { context: { path: req_path } });
    agentLists = JSON.parse(agentData.response).agents;

    loggedInUserId = (await client.data.get("loggedInUser")).loggedInUser.user.id;
    loggedInUserInfo = agentLists.filter(element => {
      return element.id === loggedInUserId
    });
    getAgentSpecificWorkspaces(loggedInUserInfo);
  } catch (err) {
    showNotify("warning", "Error", "Error while getting the agents");
    console.log("Log: getAllAgents -> err", err);
  }
}

function getAgentSpecificWorkspaces(loggedInUserInfo) {
  var workspaces = loggedInUserInfo[0].workspace_ids
  var req_path = '/api/v2/workspaces';
  client.request.invokeTemplate("getRequestApiTemplate", { context: { path: req_path } })
  .then(function (data) {
    workspaceData = JSON.parse(data.response).workspaces;
    filteredWorkspaces = workspaceData.filter(workspace => workspaces.includes(workspace.id));

    const generatedTemplate = genarateDynamicTemplates(filteredWorkspaces);

    getIparamfromDb();

    document.getElementById("container").innerHTML = generatedTemplate;
  })
  .catch(function (err) {
    showNotify("warning", "Error", "Error while getting the Groups new");
    console.log("Log: getWorkspaces -> err", err);
  });
}

function getGroups(workspaceId) {
  var req_path = '/api/v2/groups';
  client.request.invokeTemplate("getGroupSpecificToWorkspace", { context: { path: req_path, workspace_id: workspaceId } }).then(function (groupData) {
    var groupsData = JSON.parse(groupData.response).groups
    $.each(groupsData, function (key, value) {
      $("#groups-" + workspaceId).append(
        $("<option></option>")
          .attr("value", value.id)
          .attr("selected", value === 0 ? true : false)
          .text(value.name)
      );
    });
    if (installed) {
      $("#groups-" + workspaceId).val(savedConfig.assignedgroup);
    }
    $("#groups-" + workspaceId).select2({
      width: "resolve" // need to override the changed default
    });
  })
    .catch(function (err) {
      showNotify("warning", "Error", "Error while getting the Groups new");
      console.log("Log: getGroups -> err", err);
    });
}

async function getAgents(workspaceId, agentLists) {
  var workspaceAgents = await agentLists.filter(async el => {
    const agents = await el.workspace_ids.includes(workspaceId);
    return agents;
  });

  $("#agents-" + workspaceId).empty();
  $("#agents-" + workspaceId).append("<option value='-1' selected='selected'>--</option>");
  
  $.each(workspaceAgents, function(key, value) {
    $("#agents-" + workspaceId).append(
      $("<option></option>")
      .attr("value", value.id)
      .attr("selected", value === 0 ? true : false)
      .text(value.first_name + " " + value.last_name)
    );
  });
  if (installed) {
    $("#agents-" + workspaceId).val(savedConfig.assignedagent);
  }
  $("#agents-" + workspaceId).select2({
    width: "resolve" // need to override the changed default
  });
}


function toggleConfiguration(workspaceId) {
  const configurationSection = document.getElementById(`configuration-${workspaceId}`);
  const row = document.getElementById(`row-${workspaceId}`);
  const arrow = document.getElementById(`arrow-${workspaceId}`);
  
  if (configurationSection.style.display === 'none') {
   //show
    configurationSection.style.display = 'block';
    row.style.backgroundColor = 'hsl(207, 57%, 81%)';
    arrow.style.transform = 'rotate(45deg)';
    arrow.style.marginTop = '3px';
    
    // cslose others
    const allSections = document.querySelectorAll('.configuration-section');
    allSections.forEach(section => {
      if (section.id !== `configuration-${workspaceId}`) {
        section.style.display = 'none';
        const rowId = section.id.replace('configuration-', 'row-');
        const otherRow = document.getElementById(rowId);
        if (otherRow) {
          otherRow.style.backgroundColor = 'hsl(204, 4%, 74%)';
          const otherArrow = document.getElementById(`arrow-${section.id.replace('configuration-', '')}`);
          if (otherArrow) {
            otherArrow.style.transform = 'rotate(225deg)';
            otherArrow.style.marginTop = '6px';
          }
        }
      }
    });
  } else {
    //hide section
    configurationSection.style.display = 'none';
    row.style.backgroundColor = 'hsl(204, 4%, 74%)';
    arrow.style.transform = 'rotate(225deg)';
    arrow.style.marginTop = '6px';
  }
}


function genarateDynamicTemplates(filteredWorkspaces) {
  let commonTemplate = (workspaceId, isPrimary) => {

    `<tr class="configuration-section" id="configuration-${workspaceId}" style="display: ${isPrimary ? 'block' : 'none'};">
      <td>
        <div>
          <div class="row">
            <span class="configuration">Configuration</span>
          </div>
          <div class="row">
          <div class="row pad20">
            <div class="col-md-12">
                <div class="row">
                    <div class="col-sm-12">
                        <span class="actionheader"> Send OOO notification when customer replies to ticket </span>
                        <input type="checkbox" class="ios8-switch ios8-switch" id="sendooonotification-${workspaceId}" onchange="handleCheckboxClick(this, '${workspaceId}')" />
                        <label for="sendooonotification-${workspaceId}"></label>
                    </div>
                </div>
            </div>
            <div class="col-md-12 slidepanel" id="oooresponse-${workspaceId}">
                <div class="row pad20">
                    <div class="col-sm-12">
                        <label for="emailbody-content-${workspaceId}" class="required">Email Body</label>
                        <span id="emailbody-error-content-${workspaceId}" class="error hide">Email Body cannot be empty.</span>
                        <span id="emailbody-image-upload-${workspaceId}" class="error hide">Some image(s) have been directly added, they will be removed in 24hrs. Please upload the file and use it's URL</span>
                        <textarea name="emailbody-content-${workspaceId}" id="emailbody-content-${workspaceId}" type="textarea"></textarea>
                    </div>
                </div>
                <div class="row pad20">
                    <div class="col-sm-12">
                        <input type="checkbox" id="allowagenedit-${workspaceId}" />
                        Allow agent to edit the notification
                    </div>
                </div>
                <div class="row pad20">
                    <div class="col-md-12">
                        <button class="btn btn-default placeholders" onmousedown="insertPlaceholder(this.value, '${workspaceId}');" value="agentname">Agent Name</button>
                        <button class="btn btn-default placeholders" onmousedown="insertPlaceholder(this.value, '${workspaceId}');" value="agentemail">Agent Email</button>
                        <button class="btn btn-default placeholders" onmousedown="insertPlaceholder(this.value, '${workspaceId}');" value="requestername">Requester Name</button>
                        <button class="btn btn-default placeholders" onmousedown="insertPlaceholder(this.value, '${workspaceId}');" value="ticketurl">Ticket Url</button>
                    </div>
                </div>
            </div>
            <div class="inner">&nbsp;</div>
        </div>
        <div class="row pad20">
          <div class="col-md-12">
              <div class="row">
                  <div class="col-sm-12">
                      <span class="actionheader"> Reassign ticket to group and agent </span>
                      <input type="checkbox" class="ios8-switch ios8-switch" id="reassigntickettogroup-${workspaceId}" onchange="reassignTicketChange(this, '${workspaceId}')"/>
                      
                      <label for="reassigntickettogroup-${workspaceId}"></label>
                  </div>
              </div>
          </div>
          <div class="col-md-12 slidepanel" id="reassign-${workspaceId}" >
              <div>
                  <span> Group: </span>
                  <div class="labelpad">
                      <select id="groups-${workspaceId}" style="width: 50%"></select>
                  </div>
              </div>
              <div class="pad20 padbottom10">
                  <span> Agent: </span>
                  <div class="labelpad">
                      <select id="agents-${workspaceId}" style="width: 50%"></select>
                  </div>
              </div>
          </div>
          <div class="inner">&nbsp;</div>
        </div>
        <div class="row pad20">
          <div class="col-md-12">
              <div class="row">
                  <div class="col-sm-12">
                      <span class="actionheader"> Unassign ticket </span>
                      <input type="checkbox" class="ios8-switch ios8-switch" id="unassignticket-${workspaceId}" onchange="unAssignTicketChange(this, '${workspaceId}')" />
                      <label for="unassignticket-${workspaceId}"></label>
                  </div>
              </div>
          </div>
          <div class="inner">&nbsp;</div>
        </div>
      </div>
      </div>
      </td>
    </tr>`
  }

  if (filteredWorkspaces.length === 1) {
    const workspace = filteredWorkspaces[0];
    
    getGroups(workspace.id);
    getAgents(workspace.id, agentLists);
    $("#container").addClass("single_workspace_view");
    
    return commonTemplate(workspace.id, workspace.primary);
  } else {
    let template = "";
    filteredWorkspaces.forEach(workspace => {
      getGroups(workspace.id)
      getAgents(workspace.id, agentLists)
      template += `
        <table style="margin-left: 18px">
          <tr id="row-${workspace.id}" class="table-row col-sm-7"  style="background-color: ${workspace.primary ? 'hsl(207, 57%, 81%)' : 'hsl(204, 4%, 74%)'}">
            <td class="semi-bold">
              <div class="circle" id="blueCircle-${workspace.id}" onclick="toggleConfiguration(${workspace.id})">
                <i id="arrow-${workspace.id}" class="arrow" style="${workspace.primary ? 'transform: rotate(45deg); margin-top: 3px;' : '6px'}" ></i>
              </div>
              ${workspace.name}<span>${workspace.primary ? '(Primary)' : ''}</span>
            </td>
          </tr>
          ${commonTemplate(workspace.id, workspace.primary)}
        </table>`;
    });
    return template;
  }
}

function displayIparamData(config) {
  $(".froala-editor").froalaEditor("html.set", "");
  $("input[type='checkbox']").prop("checked", false).trigger("change");
  $("select").val("").trigger("change");
  console.log("config", config);
  Object.values(config.ws_configurations).forEach(obj => {
    console.log("obj", obj.assignedgroup)
    initiparamfroala(obj.workspaceId);
    $("#emailbody-content-" + obj.workspaceId).froalaEditor("html.set", obj.emailbody);
    $("#allowagenedit-" + obj.workspaceId).prop("checked", obj.canagenteditemail).trigger("change");
    $("#sendooonotification-" + obj.workspaceId).prop("checked", obj.sendooonotification).trigger("change");
    //$("#emailContainer-"+ obj.workspaceId).toggleClass("hide", !obj.sendooonotification);
    $("#reassigntickettogroup-" + obj.workspaceId).prop("checked", obj.reassigntickettogroup).trigger("change");
    $("#unassignticket-" + obj.workspaceId).prop("checked", obj.unassignticket).trigger("change");
    $("#agents-" + obj.workspaceId).val(obj.assignedagent).trigger("change");
    $("#groups-" + obj.workspaceId).val(obj.assignedgroup).trigger("change");
  });
}


function getIparamfromDb() {
  if ($('[data-view="config"]').is(':visible')) {
    if (iparamCached == true) {
      displayIparamData(cachedIparam);
    } else {
      client.db.get("iparam").then(function (config) {
        //  iparamCached = true;
        cachedIparam = config;
        displayIparamData(cachedIparam);
      }, function () {
        // failure operation
        console.log("Error - while fetching the configuration");
      });
    }
  } 
}

function initsaveIparams() {
  $("#saveIparam").unbind();
  $("#saveIparam").click(function () {
    // Code to populate iparamObject
    // const iparamObject = {}; // Initialize iparamObject
    var workspace = {};
    filteredWorkspaces.forEach(workspace => {
        if ($("#sendooonotification-" + workspace.id).is(":checked") && $("#emailbody-content-" + workspace.id).froalaEditor("html.get") == "" && !$("#allowagenedit-" + workspace.id).is(":checked")) {
            showNotify("error", "Invalid", "Email body cannot be empty when 'Allow agent to edit the notification' is not selected");
        } else if (validateIparam()) {
            var obj = {
                validconfig: true,
                sendooonotification: $("#sendooonotification-" + workspace.id).is(":checked"),
                reassigntickettogroup: $("#reassigntickettogroup-" + workspace.id).is(":checked"),  
                unassignticket: $("#unassignticket-" + workspace.id).is(":checked"),
                emailbody: $("#emailbody-content-" + workspace.id).froalaEditor("html.get"),
                canagenteditemail: $("#allowagenedit-" + workspace.id).is(":checked"),
                assignedgroup: $("#groups-" + workspace.id).val(),
                assignedagent: $("#agents-" + workspace.id).val(),
                workspaceId: workspace.id
            };
            workspace[workspace.id] = obj;
        }
    });
    // iparamObject["workspace"] = workspace;

    if (Object.keys(workspace).length > 0) {
        saveiparamindb("iparam", workspace);
    } else {
        showNotify("error", "Invalid", "Please enable at least one configuration");
    }

  });
}

function validateIparam() {
  var enabledOperations = $("input[type='checkbox'].ios8-switch:checked").length;
  return enabledOperations > 0
}

function saveiparamindb(name, workspaceObj) {
  //sample: ws_configurations: {2: {}, 3: {}}
  client.db.set(name, { ws_configurations: workspaceObj }).then(
    function () {
      showNotify("success", "Successful", "Configuration Saved");
    },
    function () {
      // failure operation
      showNotify("error", "Not Saved", "Something went wrong!");
    }
  );
}



