# Small command-line to manipulate tags at IBM Cloud

<!-- TOC -->

- [Small command-line to manipulate tags at IBM Cloud](#small-command-line-to-manipulate-tags-at-ibm-cloud)
    - [Audience](#audience)
    - [Installation](#installation)
    - [Usage](#usage)
    - [Sub-commands reference](#sub-commands-reference)
        - [attach-tag](#attach-tag)
        - [detach-tag](#detach-tag)
        - [replace-tag](#replace-tag)
        - [detach-tag-by-name](#detach-tag-by-name)
        - [clean-unused-tags](#clean-unused-tags)
        - [replace-tag-name](#replace-tag-name)
        - [duplicate-tag](#duplicate-tag)
        - [report-present-tags](#report-present-tags)
        - [report-absent-tags](#report-absent-tags)

<!-- /TOC -->

## Audience

This Node.js application allows users to attach, detach and manage tags at scale, selecting several resources at once and directly applying tag commands on them. The application was designed to address the following use cases:

* attaching/detaching of a set of tags in a set of resources and resource groups;
* exclusion of unused tags - tags not attached to any resource;
* replace of tags in a set of resources and resource groups - i.e a replace of a tag from abc:1 to abc:4 means to detach the tag abc:1 and attach a tag with value abc:4;
* detaching of a tag by name in a set of resources and resource groups - i.e, deprecation of a tag named abc, no matter its value.
* replace of a tag name.
* useful reports for tag management.

This application uses the following IBM Cloud Platform APIs:

Global Search, to retrieve information about resource groups and resource instances:
https://cloud.ibm.com/apidocs/search

Global Tagging, to manipulate tags:
https://cloud.ibm.com/apidocs/tagging

## Installation

After cloning this repo, you must install the dependencies using npm:

```bash
cd <root_folder_of_cloned_repo>
npm install
```

The following dependencies will be installed:

* winston
* ibm-platform-services

## Usage

The application has the following general structure:

````
node ibm-tags.js <Operation> <Tag1> <Tag2>...<TagN> -- <ResourceSelector1> <ResourceSelector2>...<ResourceSelectorN> -- <IBM Cloud API Key>
````
----
**Operation:** desired operation to run. Available values:

* [attach-tag](#attach-tag)
* [clean-unused-tags](#clean-unused-tags)
* [detach-tag](#detach-tag)
* [detach-tag-by-name](#detach-tag-by-name)
* [replace-tag](#replace-tag)
* [replace-tag-name](#replace-tag-name)
* [report-present-tags](#report-present-tags)
* [report-absent-tags](#report-absent-tags)

Consider the documentation of each sub-command for details.

----

**Tags:** a space-delimited list of tags to be used for operation. At IBM Cloud, there are two types of tags:

* labels, which does not have a value associated with it (ex: plus)
* key-value pairs, which has a name and a value associated with it (ex: type:plus)

Depending of the operation to be used, you should type the entire value of a key-value tag or only the key.

----

**ResourceSelector:** space-delimited list of conditions to select resources. It can be the following:

* name of a resource;
* name of a resource group - in this case, all resource instances that belongs to matched resource group name will be tagged.
* word 'all' : if *all* is used as the first position of this list, all account resources are tagged.
* substring pattern: if the beginning of a resource selector is *substr:*, resource group and resource instance names that contains the informed substring after colon (:) will be selected, and all resources instances matched to the pattern and all resource instances that belongs to a selected resource group are tagged.

Examples:
Supposing you have the following resource structure in your account:

```
ResourceGroup1
    ResourceInstanceA
    ResourceInstanceB

ResourceGroup2
    ResourceInstanceC
    ResInstanceD

ResGroup3
    ResInstanceE
    ResInstanceF
```

If you use as a resource selector:

- ResourceInstanceA -> only the ResourceInstanceA is tagged
- ResourceGroup1 -> resources ResourceInstanceA and ResourceInstanceB are tagged
- substr:ResourceGroup -> resources ResourceInstanceA, ResourceInstanceB, ResourceInstanceC and ResInstanceD are tagged
- substr:ResourceInstance -> resources ResourceInstanceA, ResourceInstanceB and ResourceInstanceC are tagged.
- all -> all resources are tagged.
   
----

**IBM Cloud API key**: API Key of a user or service ID that has permissions to view all resources. Additional instructions of creating this API Key can be found here:

https://cloud.ibm.com/docs/account?topic=account-userapikey#create_user_key

_Note: you can use the environment variable IBMCLOUD\_API\_KEY and omit this value in the command line._

## Sub-commands reference

### attach-tag

Includes one or more tags to a set of resources. If the tag does not exist, it will be created.
It must have at least one tag to be created and a resource selector that returns resource instances (see ResourceSelector above):

Use Case: your tag management team decided to include new tags to control environment and a department a resource belongs to. You have more than 200 resources in your account and need to set some tags according to your resource group structure.

Example:

```bash
node ibm-tags.js attach-tag depto:dcd empresa:bradesco ambiente:prod  -- DCD_Agencias_1 Default -- My_API_KEY
```

### detach-tag

Detaches one or more tags to a set of resources. This operation does not delete the tag from IBM Cloud account.

It must have at least one tag to be created and a resource selector that returns resource instances (see ResourceSelector above):

Use Case: you mistakenly ran the attach-tags command in a wrong set of resources and needs to rollback it.

Example:

```bash
node ibm-tags.js detach-tag depto:dcd empresa:bradesco ambiente:prod  -- DCD_Agencias_1 Default -- My_API_KEY
```

### replace-tag

Detach a tag with a specific value and attach a new one replacing the old one. This does not delete the tag in IBM Cloud account. If the new tag does not exist, it is created.

In the tag section, it must have two values: the tag to look for and the tag to replace with. Unexpected behavior will take place if more than two tags are passed. Additional tag values will be ignored.

Use Case: a company reorganization takes places and departments have now different names and structures. You have a tag with the old department name and now you want to replace with the new department name.

Example:

replace tag name depto and value dcd with tag name depto and value cdec for resource group Default.
```
node ibm-tags.js replace-tag depto:dcd depto:cdec -- Default -- My_API_KEY
```

### detach-tag-by-name

Looks for tags with a specific name and detach it from selected resources. Only the name portion is considered, no matter the value after colon. The tag is not deleted from IBM Cloud account.

Use Case: a tag becomes deprecated and must be removed from all resources.

Example:
```bash
# it will delete tags with name depto, no matter value
# (ex: depto:cdec, depto:other, etc)
node ibm-tags.js detach-tag-by-name depto -- Default -- My_API_KEY
```

### clean-unused-tags

Remove tags that are no longer attached to any resource from the IBM Cloud platform. The list of tags and resource selectors should be empty and any existent values will be ignored by this command.

Use Case: cleanup of unused tags.

Example:
```bash
node ibm-tags.js clean-unused-tags -- -- My_API_KEY
```

### replace-tag-name

Replace a tag name by another, keeping the original value for name:value tags. The list of tags must have two values: the old tag name and the new desired name. Unexpected behavior will occur if only one tag is passed. Additional tags in the list will be ignored.

Use case: your tag management team decided to change a tag name for a shorter format, for instance.

Example:
```bash
# it will replace all tags with name department by tag name depto for all account resources
node ibm-tags.js replace-tag-name department depto -- all -- My_API_KEY
```

### duplicate-tag

Creates a new tag with a different name using the value of the old variable. If the new tag exists in the resource, it is synched up with the value of the old variable.

Use case: a company reorganization takes places and they decide to change a tag naming convention without detaching the old tag from resources (for example, they are still used by billing reports). 

Example:
```bash
# it will create a new tag named depto in all resources that have a tag named department. The value of department is carried out to depto as well.
node ibm-tags.js duplicate-tag department depto -- all -- My_API_KEY
```

### report-present-tags

This command sends to standard output all resources that has the set of tag names. This command ignores the value portion of tag. If one of passed tags are found, the resource is printed together with the first tag found.

Use case: ensure some tag was correctly applied to a set of resources, no matter its value portion.

Example: 

```bash
# It will print all resources that has this tag attached to.
node ibm-tags.js report-present-tags depto -- all -- My_API_KEY
```

### report-absent-tags

This command send to standard output all resources that don't have a specific tag name attached to them. 

Use case: determine what resources are missing some required tag.

Example: 

```bash
# It will print all resources that don't have depto tag set.
node ibm-tags.js report-absent-tags depto -- all -- My_API_KEY
```