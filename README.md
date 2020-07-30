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

<!-- /TOC -->

## Audience

This Node.js application allows users to attach, detach and manage tags at scale, selecting several resources at once and directly applying tag commands on them. The application was designed to address the following use cases:

* attaching/detaching of a set of tags in a set of resources and resource groups;
* exclusion of unused tags - tags not attached to any resource;
* replace of tags in a set of resources and resource groups - i.e a replace of a tag from abc:1 to abc:4 means to detach the tag abc:1 and attach a tag with value abc:4;
* detaching of a tag by name in a set of resources and resource groups - i.e, deprecation of a tag named abc, no matter its value.
* replace of a tag name - not fully implemented yet.

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
node index.js replace-tag depto:dcd depto:cdec -- Default -- My_API_KEY
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
